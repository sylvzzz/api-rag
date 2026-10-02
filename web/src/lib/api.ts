const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface Chat {
  chat_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatListResponse {
  chats: Chat[]
}

export interface ChatMessage {
  role: string
  content: string
  created_at?: string
}

export interface ChatHistoryResponse {
  chat_id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface AskResponse {
  answer: string
  sources: Array<{ document_id: string; text: string }>
  chat_id: string
}

export interface UploadResponse {
  document_id: string
  original_name: string
  chunks: number
}

export interface Document {
  document_id: string
  original_name?: string
  chunk_count: number
  uploaded_at: string
}

export interface DocumentsResponse {
  documents: Document[]
}

export async function askQuestion(
  question: string,
  chatId?: string | null,
  howMany = 5
): Promise<AskResponse> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      chat_id: chatId,
      how_many: howMany,
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to ask question')
  }
  return response.json()
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/upload`)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded * 95) / event.total) // cap at 95% until done
        onProgress(progress)
      }
    })

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (e) {
          reject(new Error('Failed to parse response'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.detail || 'Upload failed'))
        } catch (e) {
          reject(new Error('Upload failed'))
        }
      }
    }

    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(formData)
  })
}

export async function getChats(): Promise<ChatListResponse> {
  const response = await fetch(`${API_BASE_URL}/chats`)
  if (!response.ok) {
    throw new Error('Failed to fetch chats')
  }
  return response.json()
}

export async function getChat(chatId: string): Promise<ChatHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/chats/${chatId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch chat')
  }
  return response.json()
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete chat')
  }
}

export async function getDocuments(): Promise<DocumentsResponse> {
  const response = await fetch(`${API_BASE_URL}/documents`)
  if (!response.ok) {
    throw new Error('Failed to fetch documents')
  }
  return response.json()
}

export async function getDocumentContent(documentId: string): Promise<{ document_id: string; content: string }> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/content`)
  if (!response.ok) {
    throw new Error('Failed to fetch document content')
  }
  return response.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete document')
  }
}

export async function downloadDocument(documentId: string): Promise<void> {
  window.open(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/download`, '_blank')
}
