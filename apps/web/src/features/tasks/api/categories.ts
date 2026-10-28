import { supabase } from '../../../lib/supabase'
import { assertWriteIdentity, getWriteIdentityRevision, runGuardedWrite } from '../../../lib/write-safety'
import {
  type Category,
  type CategoryRow,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  rowToCategory,
} from '../types'

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data as CategoryRow[]) || []).map(rowToCategory)
}

async function createCategoryImpl(input: CreateCategoryInput): Promise<Category> {
  const identity = getWriteIdentityRevision()
  const trimmedName = input.name?.trim()
  if (!trimmedName) {
    throw new Error('Category name cannot be blank')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  assertWriteIdentity(identity)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: session.user.id,
      name: trimmedName,
      icon: input.icon || null,
      color: input.color || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return rowToCategory(data as CategoryRow)
}

async function updateCategoryImpl(
  id: string,
  input: UpdateCategoryInput
): Promise<Category> {
  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (!trimmed) {
      throw new Error('Category name cannot be blank')
    }
    updates.name = trimmed
  }
  if (input.icon !== undefined) updates.icon = input.icon || null
  if (input.color !== undefined) updates.color = input.color || null

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return rowToCategory(data as CategoryRow)
}

async function deleteCategoryImpl(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}

export const createCategory: typeof createCategoryImpl = (...args) => runGuardedWrite(() => createCategoryImpl(...args))
export const updateCategory: typeof updateCategoryImpl = (...args) => runGuardedWrite(() => updateCategoryImpl(...args))
export const deleteCategory: typeof deleteCategoryImpl = (...args) => runGuardedWrite(() => deleteCategoryImpl(...args))
