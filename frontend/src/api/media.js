import client from "./client";

export const generateTTS = (text) =>
  client.post("/media/tts/", { text });

export const checkPronunciation = (audioBlob, expectedText, vocabularyId) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("expected_text", expectedText);
  if (vocabularyId) {
    formData.append("vocabulary_id", vocabularyId);
  }
  return client.post("/media/pronunciation/check/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const startDictation = () =>
  client.get("/media/dictation/start/");

export const checkDictation = (audioClipId, userText) =>
  client.post("/media/dictation/check/", {
    audio_clip_id: audioClipId,
    user_text: userText,
  });
