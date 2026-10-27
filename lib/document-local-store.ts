const DATABASE = "infobiz-document-cache"
const STORE = "documents"
let database: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (database) return database
  database = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("브라우저 문서 저장소를 사용할 수 없습니다.")); return }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("브라우저 문서 저장소를 열지 못했습니다."))
    request.onblocked = () => reject(new Error("다른 탭에서 문서 저장소를 사용 중입니다. 다른 대시보드 탭을 닫고 다시 시도해주세요."))
  }).catch(error => { database = null; throw error })
  return database
}

export async function readLocalDocument(key: string): Promise<string | null> {
  try {
    const db = await openDatabase()
    const value = await new Promise<string | null>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key)
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null)
      request.onerror = () => reject(request.error)
    })
    if (value !== null) {
      try { localStorage.removeItem(key) } catch {}
      return value
    }
  } catch { /* Older browser data may still be recoverable from localStorage. */ }

  let legacy: string | null = null
  try { legacy = localStorage.getItem(key) } catch {}
  if (legacy === null) return null
  try {
    await writeLocalDocument(key, legacy)
    localStorage.removeItem(key)
  } catch { /* Keep the legacy copy intact unless migration succeeds. */ }
  return legacy
}

export async function writeLocalDocument(key: string, value: string): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite")
    transaction.objectStore(STORE).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error("브라우저 저장공간에 기록하지 못했습니다."))
    transaction.onabort = () => reject(transaction.error || new Error("브라우저 저장 요청이 취소됐습니다."))
  })
}

export async function deleteLocalDocument(key: string): Promise<void> {
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite")
      transaction.objectStore(STORE).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    try { localStorage.removeItem(key) } catch {}
  }
}
