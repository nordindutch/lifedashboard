import { useQuery } from '@tanstack/react-query';
import * as notesApi from '../api/notes';
import type { NoteBody, NoteFilters } from '../api/notes';
import type { Note } from '../types';
import { useResourceMutation } from './useResourceMutation';

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

export function useCreateNote() {
  return useResourceMutation<NoteBody, Note>(['notes'], (body) => notesApi.createNote(body));
}

export function useUpdateNote() {
  return useResourceMutation<{ id: number; body: NoteBody }, Note>(['notes'], ({ id, body }) =>
    notesApi.updateNote(id, body),
  );
}

export function useDeleteNote() {
  return useResourceMutation<number, { deleted: boolean }>(['notes'], (id) => notesApi.deleteNote(id));
}
