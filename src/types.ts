export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64Data: string; // Used for images and files
  textContent?: string; // Used for code/text files
  language?: string; // e.g. 'python', 'cpp', 'json'
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  attachments?: Attachment[];
  mode?: "fast" | "detailed";
  roboticsContext?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  roboticsContext: "general" | "ros" | "arduino" | "kinematics" | "simulation";
  mode: "fast" | "detailed";
}

export type RoboticsContextType = "general" | "ros" | "arduino" | "kinematics" | "simulation";
export type ModelModeType = "fast" | "detailed";
