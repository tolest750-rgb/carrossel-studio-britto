import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface Project {
  id: string;
  name: string;
  script_data: any;
  parameters: any;
  created_at: string;
  updated_at: string;
}

export interface ProjectGeneration {
  id: string;
  project_id: string;
  slide_index: number;
  variation_index: number;
  image_url: string | null;
  final_prompt: string | null;
  model_used: string | null;
  created_at: string;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (name: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name, script_data: {}, parameters: {} })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return data as Project;
  }, [user, refresh]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("generations").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<Project>) => {
    await supabase.from("projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    await refresh();
  }, [refresh]);

  const rename = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await supabase.from("projects").update({ name: trimmed, updated_at: new Date().toISOString() }).eq("id", id);
    await refresh();
  }, [refresh]);

  const getCounts = useCallback(async (): Promise<Record<string, number>> => {
    if (!user) return {};
    const { data } = await supabase
      .from("generations")
      .select("project_id")
      .not("image_url", "is", null);
    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      counts[row.project_id] = (counts[row.project_id] || 0) + 1;
    });
    return counts;
  }, [user]);

  const getGenerations = useCallback(async (projectId: string): Promise<ProjectGeneration[]> => {
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    return (data as ProjectGeneration[]) || [];
  }, []);

  return { projects, loading, refresh, create, remove, update, getGenerations };
}
