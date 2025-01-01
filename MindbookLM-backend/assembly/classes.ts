// classes.ts
@json
export class Note {
  text: string;
  embedding: f32[];
  dayName :string;

  constructor(
    text: string = "",
    embedding: f32[] = [],
    dayName: string = ""
  ) {
    this.text = text;
    this.embedding = embedding;
    this.dayName=dayName;
  }
}

@json
export class NoteResult {
  note: Note;
  score: f32;
  relatedNotes: string[];  // Array of related note texts

  constructor(
    note: Note,
    score: f32,
    relatedNotes: string[] = []  // Default to empty array
  ) {
    this.note = note;
    this.score = score;
    this.relatedNotes = relatedNotes;
  }
}