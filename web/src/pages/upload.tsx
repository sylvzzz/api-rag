import { useState, useRef, useEffect } from "react"
import { Upload as UploadIcon, File, X, Check, Database, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { uploadFile, getDocuments, getDocumentContent, deleteDocument, downloadDocument, type Document } from "@/lib/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error"

interface FileUploadItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
  result?: { document_id: string; original_name: string; chunks: number }
}

export function Upload() {
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [, setLoadingDocs] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [docContent, setDocContent] = useState<string>("")
  const [loadingContent, setLoadingContent] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const items: FileUploadItem[] = Array.from(newFiles).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "idle",
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...items])
  }

  const startUpload = async (item: FileUploadItem) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? { ...f, status: "uploading", progress: 0, error: undefined }
          : f
      )
    )

    try {
      const result = await uploadFile(item.file, (progress) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, progress } : f))
        )
      })
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: "success", progress: 100, result }
            : f
        )
      )
      loadDocuments()
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      )
    }
  }

  const uploadAll = () => {
    files
      .filter((f) => f.status === "idle" || f.status === "error")
      .forEach(startUpload)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }


  const loadDocuments = async () => {
    setLoadingDocs(true)
    try {
      const res = await getDocuments()
      setDocuments(res.documents)
    } catch (error) {
      console.error("Failed to load documents:", error)
    } finally {
      setLoadingDocs(false)
    }
  }


  const handleDeleteDocument = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation()
    toast("Delete this document?", {
      description: "This will remove all data for this file.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await deleteDocument(doc.document_id)
            await loadDocuments()
            toast.success("Document deleted")
          } catch (error) {
            toast.error("Failed to delete document")
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    })
  }

  useEffect(() => {
    loadDocuments()
  }, [])


  const viewDocument = async (doc: Document) => {
    setSelectedDoc(doc)
    setModalOpen(true)
    setLoadingContent(true)
    setDocContent("")
    try {
      const res = await getDocumentContent(doc.document_id)
      setDocContent(res.content)
    } catch (error) {
      toast.error("Failed to load document content")
      setDocContent("Failed to load content")
    } finally {
      setLoadingContent(false)
    }
  }


  const getStatusText = (status: UploadStatus) => {
    switch (status) {
      case "uploading":
        return "Uploading..."
      case "processing":
        return "Processing & embedding..."
      case "success":
        return "Done"
      case "error":
        return "Failed"
      default:
        return "Ready"
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Upload Documents
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Upload text-based files (PDFs, Markdown, TXT, source code, etc.).
            Images and videos are not supported yet.
          </p>
        </div>

        <div
          ref={dropZoneRef}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleFiles(e.dataTransfer.files)
          }}
          className="border-border hover:border-primary/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors md:p-12"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="text-muted-foreground mb-4 h-10 w-10" />
          <p className="text-lg font-medium">Drop files here or click to browse</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Supports PDF, .txt, .md, .json, .csv, code files and more
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.txt,.md,.markdown,.json,.csv,.tsv,.xml,.html,.htm,.rst,.log,.py,.js,.ts,.jsx,.tsx,.java,.cpp,.c,.h,.go,.rs,.rb,.php,.sh,.yaml,.yml,.toml,.ini,.cfg,.conf"
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Files to upload</h2>
              <Button onClick={uploadAll} size="sm">
                Upload All
              </Button>
            </div>

            <div className="space-y-3">
              {files.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-3">
                        <div className="bg-muted mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                          <File className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="truncate text-sm font-medium">
                              {item.file.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {formatFileSize(item.file.size)} • {getStatusText(item.status)}
                            </p>
                          </div>

                          {(item.status === "uploading" || item.status === "processing") && (
                            <div className="space-y-1">
                              <Progress value={item.progress} className="h-1.5" />
                              <p className="text-muted-foreground text-xs">
                                {item.progress}% complete
                              </p>
                            </div>
                          )}

                          {item.status === "success" && item.result && (
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Check className="h-3.5 w-3.5 text-green-500" />
                              <span>
                                {item.result.chunks} chunks embedded • ID:{" "}
                                {item.result.original_name}
                              </span>
                            </div>
                          )}

                          {item.status === "error" && item.error && (
                            <p className="text-xs text-red-500">{item.error}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(item.id)}
                        className="h-8 w-8 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        

        {documents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Uploaded Documents
                  </h2>
                  <span className="text-muted-foreground text-sm">
                    {documents.length} document{documents.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[400px]">
                      <div className="divide-y">
                        {documents.map((doc) => (
                          <div
                            key={doc.original_name || doc.document_id}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => viewDocument(doc)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {doc.original_name || doc.document_id}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""} • Uploaded{" "}
                                {new Date(doc.uploaded_at).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadDocument(doc.document_id)
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => handleDeleteDocument(doc, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}



        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="truncate">{selectedDoc?.original_name || selectedDoc?.document_id}</DialogTitle>
              <DialogDescription>
                {selectedDoc?.chunk_count} chunk{selectedDoc?.chunk_count !== 1 ? "s" : ""} • Uploaded{" "}
                {selectedDoc ? new Date(selectedDoc.uploaded_at).toLocaleString() : ""}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0 overflow-auto">
              <div className="whitespace-pre-wrap text-sm p-4 rounded-md bg-muted/30">
                {loadingContent ? "Loading..." : docContent}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
