export interface SessionChatMessage {
  id: string;
  appointment_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'therapist' | 'patient';
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'other' | 'system';
  senderName?: string;
  time?: string;
}