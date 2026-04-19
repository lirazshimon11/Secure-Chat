// Static decoy messages — shown to users who have an active protection on them.
// These are intentionally boring / mundane to not raise suspicion.

export type DecoyMessage = {
  id: string;
  isMe: boolean;
  body: string;
  created_at: string;
};

// Base timestamp: roughly "yesterday"
const BASE_TS = new Date(Date.now() - 24 * 60 * 60 * 1000);
const t = (offsetMinutes: number) =>
  new Date(BASE_TS.getTime() + offsetMinutes * 60 * 1000).toISOString();

export const DECOY_MESSAGES: DecoyMessage[] = [
  { id: "d1",  isMe: false, body: "מה נשמע? 😊",                          created_at: t(0)   },
  { id: "d2",  isMe: true,  body: "הכל בסדר, מה איתך?",                   created_at: t(2)   },
  { id: "d3",  isMe: false, body: "ממש טוב תודה 👍",                       created_at: t(3)   },
  { id: "d4",  isMe: false, body: "ראיתם את הגמר אמש?",                   created_at: t(60)  },
  { id: "d5",  isMe: true,  body: "כן! מטורף היה, מה משחק 🔥",             created_at: t(62)  },
  { id: "d6",  isMe: false, body: "הכי טוב עונה בטח",                     created_at: t(63)  },
  { id: "d7",  isMe: true,  body: "מישהו רוצה להפגש השבוע?",              created_at: t(65)  },
  { id: "d8",  isMe: false, body: "אני פנוי ביום שלישי",                  created_at: t(67)  },
  { id: "d9",  isMe: true,  body: "נסדר ביום שלישי אצלי אז 🏠",           created_at: t(68)  },
  { id: "d10", isMe: false, body: "סבבה, מה מביאים?",                     created_at: t(70)  },
  { id: "d11", isMe: true,  body: "בואו כל אחד משהו לנשנוש 🍿",           created_at: t(72)  },
  { id: "d12", isMe: false, body: "קלאסי 😄 ביי",                          created_at: t(80)  },
];
