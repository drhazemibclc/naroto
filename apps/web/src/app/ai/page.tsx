'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { AlertCircle, Baby, Bot, Info, Send, Sparkles, Stethoscope, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Sample suggested questions for pediatric clinic
const SUGGESTED_QUESTIONS = [
  {
    icon: <Baby className='h-4 w-4' />,
    text: 'What vaccines does my 2-month-old need?',
    category: 'vaccines'
  },
  {
    icon: <Stethoscope className='h-4 w-4' />,
    text: "When should I worry about my child's fever?",
    category: 'symptoms'
  },
  {
    icon: <Baby className='h-4 w-4' />,
    text: 'Typical weight for a 6-month-old?',
    category: 'growth'
  },
  {
    icon: <Info className='h-4 w-4' />,
    text: 'How to prepare for first pediatric visit?',
    category: 'appointments'
  }
];

export default function AIPage() {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai'
    })
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === 'streaming') return;

    sendMessage({ text });
    setInput('');
  };

  const handleSuggestionClick = (question: string) => {
    sendMessage({ text: question });
    setShowSuggestions(false);
  };

  const isStreaming = status === 'streaming';
  const isLoading = status === 'submitted';
  const id = useId();
  return (
    <TooltipProvider>
      <div className='container mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col p-4'>
        {/* Header */}
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='rounded-full bg-primary/10 p-2'>
              <Bot className='h-6 w-6 text-primary' />
            </div>
            <div>
              <h1 className='font-bold text-2xl'>Pediatric AI Assistant</h1>
              <p className='text-muted-foreground text-sm'>
                Ask me anything about your child's health, development, or appointments
              </p>
            </div>
          </div>
          <Badge
            className='gap-1'
            variant='outline'
          >
            <Sparkles className='h-3 w-3' />
            Powered by AI
          </Badge>
        </div>

        <Separator className='mb-4' />

        {/* Main Chat Area */}
        <Card className='flex flex-1 flex-col overflow-hidden border shadow-lg'>
          <ScrollArea className='flex-1 p-4'>
            {error && (
              <div className='mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
                <div className='flex items-center gap-2 text-destructive'>
                  <AlertCircle className='h-5 w-5' />
                  <p className='font-medium'>Failed to send message</p>
                </div>
                <Button
                  className='mt-2'
                  onClick={() =>
                    sendMessage({
                      text:
                        messages
                          .at(-1)
                          ?.parts?.filter(p => p.type === 'text')
                          .map(p => p.text)
                          .join('') || ''
                    })
                  }
                  size='sm'
                  variant='outline'
                >
                  Try again
                </Button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className='flex h-full flex-col items-center justify-center space-y-6 py-12'>
                <div className='rounded-full bg-primary/5 p-4'>
                  <Bot className='h-12 w-12 text-primary/50' />
                </div>
                <div className='text-center'>
                  <h2 className='font-semibold text-xl'>Welcome to Pediatric AI Assistant</h2>
                  <p className='mt-2 text-muted-foreground'>
                    I'm here to help with questions about your child's health, development milestones, vaccines, and
                    appointments.
                  </p>
                </div>

                {showSuggestions && (
                  <div className='w-full max-w-md space-y-3'>
                    <p className='text-center font-medium text-muted-foreground text-sm'>Suggested questions:</p>
                    <div className='grid gap-2'>
                      {SUGGESTED_QUESTIONS.map(q => (
                        <Button
                          className='h-auto justify-start gap-2 whitespace-normal p-3 text-left'
                          disabled={isLoading || isStreaming}
                          key={id + q.text}
                          onClick={() => handleSuggestionClick(q.text)}
                          variant='outline'
                        >
                          {q.icon}
                          <span className='flex-1'>{q.text}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='space-y-4'>
                {messages.map((message, index) => (
                  <div
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    key={message.id}
                  >
                    {/* Avatar */}
                    <Avatar className={message.role === 'user' ? 'bg-primary' : 'bg-secondary'}>
                      <AvatarFallback>
                        {message.role === 'user' ? <User className='h-4 w-4' /> : <Bot className='h-4 w-4' />}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Content */}
                    <div
                      className={`flex max-w-[80%] flex-col rounded-lg px-4 py-2 ${
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <div className='mb-1 text-xs opacity-70'>{message.role === 'user' ? 'You' : 'AI Assistant'}</div>

                      {message.parts?.map(part => {
                        if (part.type === 'text') {
                          return (
                            <Streamdown
                              className='prose prose-sm dark:prose-invert max-w-none'
                              isAnimating={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                              key={id + part.text}
                            >
                              {part.text}
                            </Streamdown>
                          );
                        }
                        return null;
                      })}

                      {/* Medical Disclaimer */}
                      {message.role === 'assistant' && index === messages.length - 1 && !isStreaming && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className='mt-2 flex cursor-help items-center gap-1 text-muted-foreground/50 text-xs'>
                              <Info className='h-3 w-3' />
                              <span>Medical disclaimer</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            className='max-w-xs'
                            side='bottom'
                          >
                            <p className='text-xs'>
                              This AI assistant provides general information and should not replace professional medical
                              advice. Always consult with your pediatrician for medical decisions.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className='mt-4 flex items-center gap-2 text-muted-foreground'>
                <div className='h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]' />
                <div className='h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]' />
                <div className='h-2 w-2 animate-bounce rounded-full bg-current' />
                <span className='text-sm'>AI is thinking...</span>
              </div>
            )}
          </ScrollArea>

          {/* Input Form */}
          <CardContent className='border-t p-4'>
            <form
              className='flex gap-2'
              onSubmit={handleSubmit}
            >
              <Input
                className='flex-1'
                disabled={isLoading || isStreaming}
                onChange={e => setInput(e.target.value)}
                placeholder='Type your question about pediatric care...'
                ref={inputRef}
                value={input}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    disabled={!input.trim() || isLoading || isStreaming}
                    size='icon'
                    type='submit'
                  >
                    <Send className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message</p>
                </TooltipContent>
              </Tooltip>
            </form>

            {/* Reset Suggestions Button */}
            {messages.length > 0 && (
              <Button
                className='mt-2 h-auto p-0 text-xs'
                onClick={() => {
                  setShowSuggestions(true);
                  inputRef.current?.focus();
                }}
                size='sm'
                variant='link'
              >
                Show suggested questions
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Footer Disclaimer */}
        <p className='mt-4 text-center text-muted-foreground text-xs'>
          ⚕️ This is an AI assistant for informational purposes only. In case of emergency, call your pediatrician or 911
          immediately.
        </p>
      </div>
    </TooltipProvider>
  );
}
