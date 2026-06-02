import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import Reviews from "./pages/Reviews";
import ReviewDetail from "./pages/ReviewDetail";
import RAGPage from "./pages/RAGPage";
import Settings from "./pages/Settings";
import MainLayout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import StreamReview from "./pages/StreamReview";
import Register from './pages/Register'

function App() {
  const token = localStorage.getItem("access_token");

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!token ? <Login /> : <Navigate to="/projects" />}
        />
        <Route path="/register" element={<Register />} />
        <Route element={<MainLayout />}>
          <Route
            path="/projects"
            element={token ? <Projects /> : <Navigate to="/login" />}
          />
          <Route
            path="/"
            element={token ? <Dashboard /> : <Navigate to="/login" />}
          />

          <Route
            path="/reviews"
            element={token ? <Reviews /> : <Navigate to="/login" />}
          />
          <Route
            path="/reviews/:id"
            element={token ? <ReviewDetail /> : <Navigate to="/login" />}
          />
          <Route
            path="/stream-review"
            element={token ? <StreamReview /> : <Navigate to="/login" />}
          />
          <Route
            path="/rag"
            element={token ? <RAGPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/settings"
            element={token ? <Settings /> : <Navigate to="/login" />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
