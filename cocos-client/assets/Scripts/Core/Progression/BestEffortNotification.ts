export function notifyBestEffort<T>(
  notifications: readonly T[],
  listener: (notification: T) => void,
) {
  for (let index = 0; index < notifications.length; index += 1) {
    try {
      listener(notifications[index])
    } catch {
    }
  }
}
