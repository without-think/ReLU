import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Send, Trash2, Reply, X, AtSign, CheckCheck } from 'lucide-react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { GroupMessage, TeamMember } from '@/types'

interface ChatPanelProps {
  groupId: number
  members?: TeamMember[]
}

export function ChatPanel({ groupId, members = [] }: ChatPanelProps) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionList, setShowMentionList] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const stompClientRef = useRef<Client | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mentionListRef = useRef<HTMLDivElement>(null)

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', groupId],
    queryFn: () => api.getMessages(groupId),
    refetchInterval: 10000,
  })

  // Fetch read receipts
  const { data: readReceipts } = useQuery({
    queryKey: ['readReceipts', groupId],
    queryFn: () => api.getReadReceipts(groupId),
    refetchInterval: 5000,
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (data: { content: string; replyToId?: number; mentionedUserIds?: number[] }) =>
      api.sendMessage(groupId, data),
    onSuccess: (newMessage) => {
      queryClient.setQueryData(['messages', groupId], (old: GroupMessage[] = []) => {
        if (old.some(m => m.id === newMessage.id)) return old
        return [...old, newMessage]
      })
      setMessage('')
      setReplyTo(null)
      inputRef.current?.focus()
    },
  })

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: (messageId: number) => api.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', groupId] })
    },
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => api.markAsRead(groupId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readReceipts', groupId] })
    },
  })

  // WebSocket connection
  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
    const socket = new SockJS(`${apiBaseUrl}/ws/chat`)
    const client = new Client({
      webSocketFactory: () => socket as unknown as WebSocket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        client.subscribe(`/topic/group/${groupId}`, (frame: IMessage) => {
          try {
            const newMessage: GroupMessage = JSON.parse(frame.body)
            queryClient.setQueryData(['messages', groupId], (old: GroupMessage[] = []) => {
              if (old.some(m => m.id === newMessage.id)) return old
              return [...old, newMessage]
            })
          } catch {
            // Parse error, ignore
          }
        })
      },
    })

    client.activate()
    stompClientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [groupId, queryClient])

  // Auto scroll to bottom and mark as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Mark latest message as read
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.senderId !== user?.id) {
        markAsReadMutation.mutate(lastMessage.id)
      }
    }
  }, [messages])

  // Extract mentioned user IDs from message content
  const extractMentions = useCallback((text: string): number[] => {
    const mentionPattern = /@(\S+)/g
    const mentions: number[] = []
    let match
    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionedName = match[1]
      const member = members.find(m => m.name === mentionedName)
      if (member) {
        mentions.push(member.userId)
      }
    }
    return mentions
  }, [members])

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || sendMutation.isPending) return

    const mentionedUserIds = extractMentions(trimmed)

    sendMutation.mutate({
      content: trimmed,
      replyToId: replyTo?.id,
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
    })
  }, [message, sendMutation, replyTo, extractMentions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && replyTo) {
      setReplyTo(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)
    setCursorPosition(e.target.selectionStart || 0)

    // Check for @ mention trigger
    const textBeforeCursor = value.substring(0, e.target.selectionStart || 0)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.substring(lastAtIndex + 1)
      if (!query.includes(' ')) {
        setMentionQuery(query)
        setShowMentionList(true)
        return
      }
    }
    setShowMentionList(false)
    setMentionQuery('')
  }

  const handleMentionSelect = (member: TeamMember) => {
    const textBeforeCursor = message.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const textAfterAt = message.substring(cursorPosition)

    const newMessage = message.substring(0, lastAtIndex) + '@' + member.name + ' ' + textAfterAt
    setMessage(newMessage)
    setShowMentionList(false)
    setMentionQuery('')
    inputRef.current?.focus()
  }

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return members
    return members.filter(m =>
      m.name.toLowerCase().includes(mentionQuery.toLowerCase())
    )
  }, [members, mentionQuery])

  const formatMessageTime = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) {
      return format(date, 'a h:mm', { locale: ko })
    }
    if (isYesterday(date)) {
      return '어제 ' + format(date, 'a h:mm', { locale: ko })
    }
    return format(date, 'M/d a h:mm', { locale: ko })
  }

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; messages: GroupMessage[] }[]>((acc, msg) => {
    const dateStr = format(parseISO(msg.createdAt), 'yyyy-MM-dd')
    const last = acc[acc.length - 1]
    if (last && last.date === dateStr) {
      last.messages.push(msg)
    } else {
      acc.push({ date: dateStr, messages: [msg] })
    }
    return acc
  }, [])

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return '오늘'
    if (isYesterday(date)) return '어제'
    return format(date, 'M월 d일 (EEEE)', { locale: ko })
  }

  // Check read status for a message
  const getReadCount = (messageId: number): number => {
    if (!readReceipts?.readStatus) return 0
    return Object.entries(readReceipts.readStatus)
      .filter(([userId, lastReadId]) =>
        Number(userId) !== user?.id && lastReadId >= messageId
      )
      .length
  }

  // Highlight mentions in message content
  const renderContent = (content: string, isOwnMessage: boolean) => {
    const parts = content.split(/(@\S+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1)
        const member = members.find(m => m.name === name)
        const isMe = member?.userId === user?.id

        // 내 메시지(초록 배경)에서는 밝은 색상 사용
        if (isOwnMessage) {
          return (
            <span
              key={i}
              className={`font-semibold ${isMe ? 'text-[#ffd700] bg-white/20 px-1 rounded' : 'text-[#b8e6c9]'}`}
            >
              {part}
            </span>
          )
        }

        return (
          <span
            key={i}
            className={`font-semibold ${isMe ? 'text-[#a8793d] bg-[#a8793d]/10 px-1 rounded' : 'text-[#4a8768]'}`}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  if (isLoading) {
    return (
      <div className="card h-[500px] flex items-center justify-center text-[#b0a8a0]">
        메시지 불러오는 중...
      </div>
    )
  }

  return (
    <div className="card flex flex-col h-[500px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#b0a8a0]">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요!
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#e7e0d7]" />
                <span className="text-xs text-[#b0a8a0] font-medium">{formatDateHeader(group.date)}</span>
                <div className="flex-1 h-px bg-[#e7e0d7]" />
              </div>

              {/* Messages */}
              <div className="space-y-2">
                {group.messages.map((msg) => {
                  const isOwn = msg.senderId === user?.id
                  const isDeleted = msg.deleted
                  const readCount = getReadCount(msg.id)
                  const isMentioned = msg.mentionedUserIds?.includes(user?.id || 0)

                  return (
                    <div
                      key={msg.id}
                      className={`group flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${
                        isMentioned ? 'bg-[#a8793d]/5 -mx-2 px-2 py-1 rounded-lg' : ''
                      }`}
                    >
                      {/* Avatar */}
                      {!isOwn && (
                        <div className="w-8 h-8 rounded-full bg-[#4a8768]/15 flex items-center justify-center text-xs font-bold text-[#4a8768] flex-shrink-0">
                          {msg.senderName.charAt(0)}
                        </div>
                      )}

                      {/* Message content */}
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!isOwn && (
                          <span className="text-xs text-[#7a7169] mb-1 ml-1">{msg.senderName}</span>
                        )}

                        {/* Reply preview */}
                        {msg.replyToId && (
                          <div className="text-xs bg-[#f2eee8]/80 text-[#7a7169] px-2 py-1 rounded-t-lg border-l-2 border-[#4a8768] mb-0.5 max-w-full">
                            <span className="font-medium">{msg.replyToSenderName}</span>
                            <p className="truncate opacity-80">{msg.replyToContent}</p>
                          </div>
                        )}

                        <div
                          className={`px-3 py-2 rounded-2xl ${
                            msg.replyToId ? 'rounded-tl-sm' : ''
                          } ${
                            isDeleted
                              ? 'bg-[#f2eee8] text-[#b0a8a0] italic'
                              : isOwn
                                ? 'bg-[#4a8768] text-white'
                                : 'bg-[#f2eee8] text-[#25231f]'
                          }`}
                        >
                          {isDeleted ? '삭제된 메시지입니다' : renderContent(msg.content, isOwn)}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 mx-1">
                          <span className="text-[10px] text-[#b0a8a0]">
                            {formatMessageTime(msg.createdAt)}
                            {msg.editedAt && ' (수정됨)'}
                          </span>
                          {/* Read receipts */}
                          {isOwn && !isDeleted && (() => {
                            const otherMembersCount = members.length - 1
                            const unreadCount = otherMembersCount - readCount

                            // 1:1 채팅 (상대 1명)
                            if (otherMembersCount === 1) {
                              return readCount > 0 ? (
                                <span className="text-[10px] text-[#4a8768] font-medium">읽음/1</span>
                              ) : (
                                <span className="text-[10px] text-[#a8793d] font-medium">1</span>
                              )
                            }

                            // 그룹 채팅 (2명 이상)
                            if (otherMembersCount >= 2) {
                              return unreadCount > 0 ? (
                                <span className="text-[10px] text-[#a8793d] font-medium">{unreadCount}</span>
                              ) : (
                                <CheckCheck className="w-3 h-3 text-[#4a8768]" />
                              )
                            }

                            return null
                          })()}
                        </div>
                      </div>

                      {/* Actions */}
                      {!isDeleted && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={() => setReplyTo(msg)}
                            className="p-1 text-[#b0a8a0] hover:text-[#4a8768] transition-colors"
                            title="답장"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {isOwn && (
                            <button
                              onClick={() => deleteMutation.mutate(msg.id)}
                              className="p-1 text-[#b0a8a0] hover:text-[#6f4141] transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-[#f2eee8] border-t border-[#e7e0d7] flex items-center gap-2">
          <Reply className="w-4 h-4 text-[#4a8768] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#4a8768]">{replyTo.senderName}에게 답장</p>
            <p className="text-xs text-[#7a7169] truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 text-[#b0a8a0] hover:text-[#6f4141] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mention autocomplete */}
      {showMentionList && filteredMembers.length > 0 && (
        <div
          ref={mentionListRef}
          className="absolute bottom-20 left-4 right-4 bg-white border border-[#e7e0d7] rounded-lg shadow-lg max-h-40 overflow-y-auto z-10"
        >
          {filteredMembers.map((member) => (
            <button
              key={member.memberId}
              onClick={() => handleMentionSelect(member)}
              className="w-full px-3 py-2 text-left hover:bg-[#f2eee8] flex items-center gap-2"
            >
              <AtSign className="w-4 h-4 text-[#4a8768]" />
              <span className="font-medium text-[#25231f]">{member.name}</span>
              <span className="text-xs text-[#b0a8a0]">{member.studentId}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[#e7e0d7] p-3 relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `${replyTo.senderName}에게 답장...` : '@로 언급, 메시지 입력...'}
            className="flex-1 px-4 py-2.5 bg-[#f2eee8] border-none rounded-full text-sm focus:ring-2 focus:ring-[#4a8768]/30 focus:outline-none placeholder:text-[#b0a8a0]"
            maxLength={2000}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-full bg-[#4a8768] text-white flex items-center justify-center hover:bg-[#3d7258] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
