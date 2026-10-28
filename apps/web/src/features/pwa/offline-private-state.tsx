import React from 'react'

export function OfflinePrivateBanner() {
  return <div className="offline-private-banner" role="status">Đang ngoại tuyến. Dữ liệu có thể đã cũ; thay đổi không được lưu cho đến khi có kết nối và bạn thử lại.</div>
}

export function OfflinePrivateState({ retry }: { retry: () => void }) {
  return <div className="auth-error-state" role="alert">
    <h2>Không thể xác minh phiên khi ngoại tuyến</h2>
    <p>Hãy kết nối mạng để truy cập dữ liệu tài khoản.</p>
    <button type="button" onClick={retry}>Thử lại</button>
  </div>
}
