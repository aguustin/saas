const DEVICE_ID_KEY   = 'saas_device_id'
const DEVICE_NAME_KEY = 'saas_device_name'

function generateId(): string {
  return crypto.randomUUID()
}

function detectDeviceName(): string {
  const ua = navigator.userAgent
  let browser = 'Browser'
  let os = 'Unknown OS'

  if (ua.includes('Chrome'))  browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari'))  browser = 'Safari'
  else if (ua.includes('Edge'))    browser = 'Edge'

  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac'))    os = 'Mac'
  else if (ua.includes('Linux'))  os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return `${browser} - ${os}`
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = generateId()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceName(): string {
  let name = localStorage.getItem(DEVICE_NAME_KEY)
  if (!name) {
    name = detectDeviceName()
    localStorage.setItem(DEVICE_NAME_KEY, name)
  }
  return name
}
