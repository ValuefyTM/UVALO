// Shared by the browser (Support.tsx) and the server (support.ts): the kinds and statuses of a ticket.
export const SUPPORT_KINDS: Record<string, string> = { problema: "Problemă", idee: "Idee", altceva: "Altceva" };
/** nou = sent, waiting for the team; citit = seen / in progress; raspuns = the team answered; rezolvat = closed. */
export const SUPPORT_STATUS: Record<string, [string, string]> = { nou: ["Deschis", "pillWarn"], citit: ["În lucru", ""], raspuns: ["Răspuns", "pillOk"], rezolvat: ["Rezolvat", ""] };
