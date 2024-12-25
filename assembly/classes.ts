// classes.ts
@json
export class Note {
  text: string;
  embedding: f32[];

  constructor(
    text: string = "",
    embedding: f32[] = []
  ) {
    this.text = text;
    this.embedding = embedding;
  }
}

@json
export class NoteResult {
  note!: Note;
  score: f32;
  relatedNotes: Note[];

  constructor(note: Note, score: f32, relatedNotes: Note[]) {
    this.note = note;
    this.score = score;
    this.relatedNotes = relatedNotes;
  }
}