export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          organization_id: string;
          role: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          organization_id: string;
          role?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          organization_id?: string;
          role?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          join_code: string;  // ← Keep as snake_case to match database
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          join_code: string;  // ← Keep as snake_case to match database
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          join_code?: string;  // ← Keep as snake_case to match database
          created_at?: string;
          updated_at?: string | null;
        };
      };
    };
  };
}