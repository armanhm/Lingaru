import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Topics from "./pages/Topics";
import TopicDetail from "./pages/TopicDetail";
import LessonDetail from "./pages/LessonDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Quiz from "./pages/Quiz";
import Dictation from "./pages/Dictation";
import Pronunciation from "./pages/Pronunciation";
import Assistant from "./pages/Assistant";
import Progress from "./pages/Progress";
import Discover from "./pages/Discover";
import SRSReview from "./pages/SRSReview";
import MistakeJournal from "./pages/MistakeJournal";
import ConjugationDrill from "./pages/ConjugationDrill";
import Documents from "./pages/Documents";
import Dictionary from "./pages/Dictionary";
import Settings from "./pages/Settings";
import MiniGames from "./pages/MiniGames";
import WordScramble from "./pages/WordScramble";
import MatchPairs from "./pages/MatchPairs";
import GenderSnap from "./pages/GenderSnap";
import SpeedRound from "./pages/SpeedRound";
import MissingLetter from "./pages/MissingLetter";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="topics" element={<Topics />} />
          <Route path="topics/:id" element={<TopicDetail />} />
          <Route path="lesson/:id" element={<LessonDetail />} />
          <Route path="practice/quiz/:lessonId" element={<Quiz />} />
          <Route path="practice/dictation" element={<Dictation />} />
          <Route path="practice/pronunciation" element={<Pronunciation />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="documents" element={<Documents />} />
          <Route path="progress" element={<Progress />} />
          <Route path="discover" element={<Discover />} />
          <Route path="practice/srs" element={<SRSReview />} />
          <Route path="practice/conjugation" element={<ConjugationDrill />} />
          <Route path="progress/mistakes" element={<MistakeJournal />} />
          <Route path="dictionary" element={<Dictionary />} />
          <Route path="mini-games" element={<MiniGames />} />
          <Route path="mini-games/word-scramble" element={<WordScramble />} />
          <Route path="mini-games/match-pairs" element={<MatchPairs />} />
          <Route path="mini-games/gender-snap" element={<GenderSnap />} />
          <Route path="mini-games/speed-round" element={<SpeedRound />} />
          <Route path="mini-games/missing-letter" element={<MissingLetter />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
