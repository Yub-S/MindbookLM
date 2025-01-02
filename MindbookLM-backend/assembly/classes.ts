@json
export class Note {
  text: string;
  embedding: f32[];
  dayName: string;

  constructor(
    text: string = "",
    embedding: f32[] = [],
    dayName: string = ""
  ) {
    this.text = text;
    this.embedding = embedding;
    this.dayName = dayName;
  }
}

@json
export class NoteResult {
  note: Note;
  score: f32;
  relatedNotes: string[];  

  constructor(
    note: Note,
    score: f32,
    relatedNotes: string[] = []  
  ) {
    this.note = note;
    this.score = score;
    this.relatedNotes = relatedNotes;
  }
}

@json
export class QueryDecision {
  processedQuery: string;
  queryType: string; // "general" or "similarity"
  timeConstraints: TimeConstraints;

  constructor(
    processedQuery: string = "",
    queryType: string = "similarity",
    timeConstraints: TimeConstraints = new TimeConstraints()
  ) {
    this.processedQuery = processedQuery;
    this.queryType = queryType;
    this.timeConstraints = timeConstraints;
  }
}

@json
export class TimeConstraints {
  year: string | null;
  month: string | null;
  day: string | null;

  constructor(
    year: string | null = null,
    month: string | null = null,
    day: string | null = null
  ) {
    this.year = year;
    this.month = month;
    this.day = day;
  }
}