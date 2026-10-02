import { useState, useEffect, useRef } from "react"
import TextareaAutosize from "react-textarea-autosize"
import { Send, Plus, MessageSquare, Trash2, UploadIcon } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { askQuestion, getChats, getChat, deleteChat, type Chat, type ChatMessage } from "@/lib/api"
import { ModeToggle } from "@/components/theme/mode-toggle"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Upload } from "./upload"

type PageType = "chat" | "upload"

function MessageInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("")

  function send() {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText("")
  }

  return (
    <div className="border-t p-4">
      <InputGroup>
        <TextareaAutosize
          data-slot="input-group-control"
          className="max-h-[200px] min-h-16 w-full min-w-0 resize-none whitespace-pre-wrap wrap-break-word rounded-md bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          placeholder="Ask a question about your documents..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={disabled}
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            className="ml-auto"
            size="sm"
            variant="default"
            onClick={send}
            disabled={!text.trim() || disabled}
          >
            <Send />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function AppSidebar({
  chats,
  currentChatId,
  currentPage,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onSelectPage,
  isLoading,
}: {
  chats: Chat[]
  currentChatId: string | null
  currentPage: PageType
  onSelectChat: (chatId: string | null) => void
  onNewChat: () => void
  onDeleteChat: (chatId: string) => void
  onSelectPage: (page: PageType) => void
  isLoading: boolean
}) {
  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <h2 className="text-lg font-semibold">RAG API</h2>
        <ModeToggle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentPage === "chat"}
                onClick={() => onSelectPage("chat")}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentPage === "upload"}
                onClick={() => onSelectPage("upload")}
              >
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <Separator />
        {currentPage === "chat" && (
          <>
            <div className="px-2 py-2">
              <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>
            <Separator />
            <SidebarGroup>
              <SidebarGroupLabel>Chat History</SidebarGroupLabel>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <SidebarMenu>
                  {isLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : chats.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No chats yet
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <SidebarMenuItem key={chat.chat_id} className="group">
                        <div className="flex w-full items-center">
                          <SidebarMenuButton
                            isActive={currentChatId === chat.chat_id}
                            onClick={() => onSelectChat(chat.chat_id)}
                            className="flex-1 truncate pr-2"
                          >
                            <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">{chat.title || "New Chat"}</span>
                          </SidebarMenuButton>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              toast("Delete this chat?", {
                                description: "This action cannot be undone.",
                                action: {
                                  label: "Delete",
                                  onClick: () => onDeleteChat(chat.chat_id),
                                },
                                cancel: {
                                  label: "Cancel",
                                  onClick: () => {},
                                },
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </ScrollArea>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2 text-sm md:max-w-[70%] whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

export function ChatApp() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentPage, setCurrentPage] = useState<PageType>("chat")
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    const scrollArea = document.querySelector('[data-slot="scroll-area-viewport"]')
    if (scrollArea) {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea as HTMLElement
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      if (isNearBottom) {
        scrollToBottom()
      }
    } else {
      scrollToBottom()
    }
  }, [messages])

  const loadChats = async () => {
    setIsLoadingChats(true)
    try {
      const res = await getChats()
      setChats(res.chats)
    } catch (error) {
      console.error("Failed to load chats:", error)
    } finally {
      setIsLoadingChats(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [])

  const loadChat = async (chatId: string) => {
    setIsLoadingMessages(true)
    try {
      const res = await getChat(chatId)
      setMessages(res.messages)
      setCurrentChatId(chatId)
    } catch (error) {
      console.error("Failed to load chat:", error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleNewChat = () => {
    setCurrentChatId(null)
    setMessages([])
  }

  const handleSelectChat = (chatId: string | null) => {
    if (chatId === null) {
      handleNewChat()
    } else {
      loadChat(chatId)
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId)
      if (currentChatId === chatId) {
        setCurrentChatId(null)
        setMessages([])
      }
      await loadChats()
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
  }

  const handleSelectPage = (page: PageType) => {
    setCurrentPage(page)
  }

  const handleSend = async (text: string) => {
    const userMessage: ChatMessage = { role: "user", content: text }
    setMessages((prev) => [...prev, userMessage])
    setIsSending(true)

    try {
      const res = await askQuestion(text, currentChatId)
      const assistantMessage: ChatMessage = { role: "assistant", content: res.answer }
      setMessages((prev) => [...prev, assistantMessage])
      if (!currentChatId || currentChatId !== res.chat_id) {
        setCurrentChatId(res.chat_id)
      }
      await loadChats()
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <SidebarProvider className="h-full">
      <AppSidebar
        chats={chats}
        currentChatId={currentChatId}
        currentPage={currentPage}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onSelectPage={handleSelectPage}
        isLoading={isLoadingChats}
      />
      <main className="flex flex-1 flex-col h-full min-h-0">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">
              {currentPage === "chat"
                ? currentChatId
                  ? chats.find((c) => c.chat_id === currentChatId)?.title || "Chat"
                  : "New Chat"
                : "Upload Documents"}
            </h1>
          </div>
        </div>
        {currentPage === "chat" ? (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
              <div className="mx-auto max-w-4xl space-y-4 p-4">
                {messages.length === 0 && !isLoadingMessages ? (
                  <div className="flex h-full min-h-0 flex-col items-center justify-center text-center py-8">
                    <MessageSquare className="text-muted-foreground mb-4 h-12 w-12" />
                    <h2 className="text-xl font-semibold">Start a conversation</h2>
                    <p className="text-muted-foreground mt-2 max-w-md text-sm">
                      Ask questions about your uploaded documents. Upload files first to get started!
                    </p>
                  </div>
                ) : (
                  messages.map((message, idx) => (
                    <MessageBubble key={idx} message={message} />
                  ))
                )}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted max-w-[80%] rounded-lg px-4 py-2 text-sm">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="flex-shrink-0">
              <MessageInput onSend={handleSend} disabled={isSending} />
            </div>
          </div>
        ) : (
          <Upload />
        )}
      </main>
    </SidebarProvider>
  )
}

export default ChatApp
