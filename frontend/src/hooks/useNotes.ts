import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notesApi from '../api/notes';
import type { NoteBody, NoteFilters } from '../api/notes';

export function useNotes(filters?: NoteFilters) {
  return useQuery({
    queryKey: ['notes', filters ?? {}],
    queryFn: async () => {
      const res = await notesApi.listNotes(filters);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

function useInvalidateNotes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['notes'] });
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (body: NoteBody) => notesApi.createNote(body),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: NoteBody }) => notesApi.updateNote(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: number) => notesApi.deleteNote(id),
    onSuccess: invalidate,
  });
}
