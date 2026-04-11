import client from "./client";

export const lookupWord = (word) => client.post("/dictionary/lookup/", { word });
export const conjugateVerb = (verb) => client.post("/dictionary/conjugate/", { verb });
