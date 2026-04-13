import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  GraduationCap, 
  History, 
  Globe, 
  FlaskConical, 
  Users, 
  Settings, 
  Cpu, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Home,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  LogIn,
  LogOut,
  Save,
  Database
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { Subject, Question, QuizData, StudyContent, AppState } from './types';
import { generateQuizFromMarkdown } from './services/gemini';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const SUBJECTS: { name: Subject; icon: React.ReactNode; color: string }[] = [
  { name: 'Lịch sử', icon: <History className="w-6 h-6" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { name: 'Địa lý', icon: <Globe className="w-6 h-6" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'KHTN', icon: <FlaskConical className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: 'GDCD', icon: <Users className="w-6 h-6" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'Công nghệ', icon: <Settings className="w-6 h-6" />, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { name: 'Tin học', icon: <Cpu className="w-6 h-6" />, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState>({
    view: 'home',
    currentQuestionIndex: 0,
    userAnswers: [],
    score: 0,
  });

  const [markdownInput, setMarkdownInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleSubjectSelect = async (subject: Subject) => {
    setIsLoading(true);
    try {
      // Try to load from Firestore first
      const materialDoc = await getDoc(doc(db, 'study_materials', subject));
      const quizDoc = await getDoc(doc(db, 'quizzes', subject));

      if (materialDoc.exists()) {
        const materialData = materialDoc.data();
        const quizData = quizDoc.exists() ? quizDoc.data() : null;

        setState(prev => ({
          ...prev,
          selectedSubject: subject,
          view: 'study',
          studyContent: { subject, content: materialData.content },
          quizData: quizData ? { subject, questions: quizData.questions } : undefined,
          currentQuestionIndex: 0,
          userAnswers: [],
          score: 0,
        }));
        setMarkdownInput(materialData.content);
      } else {
        setState(prev => ({ ...prev, selectedSubject: subject, view: 'upload' }));
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
      setState(prev => ({ ...prev, selectedSubject: subject, view: 'upload' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessMarkdown = async () => {
    if (!markdownInput.trim()) {
      setError('Vui lòng nhập nội dung đề cương.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const questions = await generateQuizFromMarkdown(state.selectedSubject!, markdownInput, questionCount);
      
      const newState: AppState = {
        ...state,
        view: 'study',
        quizData: { subject: state.selectedSubject!, questions },
        studyContent: { subject: state.selectedSubject!, content: markdownInput },
        currentQuestionIndex: 0,
        userAnswers: [],
        score: 0,
      };

      setState(newState);

      // Save to Firebase if logged in
      if (user) {
        await saveToFirebase(state.selectedSubject!, markdownInput, questions);
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi xử lý nội dung. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setMarkdownInput(content);
    };
    reader.readAsText(file);
  };

  const saveToFirebase = async (subject: Subject, content: string, questions: Question[]) => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'study_materials', subject), {
        subject,
        content,
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'quizzes', subject), {
        subject,
        questions,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.error("Lỗi khi lưu vào Firebase:", err);
      setError("Không thể lưu vào CSDL. Vui lòng kiểm tra quyền truy cập.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!user) {
      setError("Vui lòng đăng nhập để lưu vào CSDL.");
      return;
    }
    if (state.selectedSubject && state.studyContent && state.quizData) {
      const success = await saveToFirebase(state.selectedSubject, state.studyContent.content, state.quizData.questions);
      if (success) {
        alert("Đã cập nhật CSDL thành công!");
      }
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const isCorrect = answerIndex === state.quizData?.questions[state.currentQuestionIndex].correctAnswer;
    
    setState(prev => {
      const newUserAnswers = [...prev.userAnswers, answerIndex];
      const newScore = isCorrect ? prev.score + 1 : prev.score;
      
      if (newUserAnswers.length === prev.quizData?.questions.length) {
        return { ...prev, userAnswers: newUserAnswers, score: newScore, view: 'result' };
      }
      
      return { ...prev, userAnswers: newUserAnswers, score: newScore, currentQuestionIndex: prev.currentQuestionIndex + 1 };
    });
  };

  const resetApp = () => {
    setState({
      view: 'home',
      currentQuestionIndex: 0,
      userAnswers: [],
      score: 0,
    });
    setMarkdownInput('');
    setError(null);
    setQuestionCount(10);
  };

  const startQuiz = () => {
    setState(prev => ({ ...prev, view: 'quiz', currentQuestionIndex: 0, userAnswers: [], score: 0 }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-indigo-200 shadow-lg">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Học Tốt Lớp 6</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                <button onClick={logout} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="Đăng xuất">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={loginWithGoogle} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-all shadow-sm">
                <LogIn className="w-4 h-4" />
                Đăng nhập
              </button>
            )}
            {state.view !== 'home' && (
              <button 
                onClick={resetApp}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {state.view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Chào mừng bạn đến với <span className="text-indigo-600">Học Tốt Lớp 6</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  Chọn môn học bạn muốn ôn luyện. Tải lên đề cương và chúng tôi sẽ giúp bạn học tập hiệu quả hơn.
                </p>
                {!user && (
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl inline-flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Đăng nhập để lưu trữ đề cương và câu hỏi vào CSDL.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {SUBJECTS.map((subject) => (
                  <motion.button
                    key={subject.name}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isLoading}
                    onClick={() => handleSubjectSelect(subject.name)}
                    className={cn(
                      "flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all shadow-sm hover:shadow-md",
                      subject.color,
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="mb-4 p-3 bg-white/50 rounded-2xl">
                      {isLoading && state.selectedSubject === subject.name ? <Loader2 className="w-6 h-6 animate-spin" /> : subject.icon}
                    </div>
                    <span className="font-bold text-lg">{subject.name}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {state.view === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 text-indigo-600 mb-2">
                  <Upload className="w-6 h-6" />
                  <h3 className="text-2xl font-bold">Nhập Đề Cương Ôn Tập</h3>
                </div>
                <p className="text-slate-600">
                  Dán nội dung đề cương môn <span className="font-bold text-indigo-600">{state.selectedSubject}</span> vào ô dưới đây. 
                  AI sẽ tự động phân tích và tạo câu hỏi cho bạn.
                </p>
                
                <div className="relative">
                  <textarea
                    value={markdownInput}
                    onChange={(e) => setMarkdownInput(e.target.value)}
                    placeholder="Ví dụ: Lịch sử là gì? Lịch sử là những gì đã xảy ra trong quá khứ..."
                    className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all resize-none font-mono text-sm"
                  />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <label className="cursor-pointer text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full font-bold hover:bg-slate-50 transition-all flex items-center gap-1 shadow-sm">
                      <Upload className="w-3 h-3" />
                      Tải file .md
                      <input type="file" accept=".md,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <button
                      onClick={() => setMarkdownInput(`# Đề cương ôn tập Lịch sử 6\n\n## 1. Lịch sử là gì?\nLịch sử là những gì đã xảy ra trong quá khứ. Môn Lịch sử là môn học tìm hiểu về cội nguồn dòng họ, tổ tiên, dân tộc và lịch sử loài người.\n\n## 2. Tại sao phải học lịch sử?\nHọc lịch sử để biết được cội nguồn, truyền thống quý báu của dân tộc. Giúp chúng ta hiểu được quá trình lao động, đấu tranh để xây dựng đất nước.\n\n## 3. Các nguồn tư liệu lịch sử\n- Tư liệu truyền miệng: Những câu chuyện kể, lời ca, tiếng hát...\n- Tư liệu hiện vật: Những di tích, đồ vật cũ...\n- Tư liệu chữ viết: Sách vở, văn bản cổ...`)}
                      className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-200 transition-all"
                    >
                      Sử dụng mẫu
                    </button>
                  </div>
                  {error && (
                    <div className="absolute -bottom-10 left-0 flex items-center gap-2 text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Số lượng câu hỏi trắc nghiệm</label>
                  <div className="flex gap-2">
                    {[10, 20, 40, 60].map(count => (
                      <button
                        key={count}
                        onClick={() => setQuestionCount(count)}
                        className={cn(
                          "flex-1 py-2 rounded-xl font-bold transition-all border-2",
                          questionCount === count 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setState(prev => ({ ...prev, view: 'home' }))}
                    className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleProcessMarkdown}
                    disabled={isLoading}
                    className="flex-[2] py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        Bắt đầu học
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {state.view === 'study' && (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="text-indigo-600" />
                  Nội dung ôn tập: {state.selectedSubject}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleManualSave}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-full font-bold hover:bg-emerald-100 transition-all shadow-sm"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu CSDL
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, view: 'upload' }))}
                    className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full font-bold hover:bg-slate-50 transition-all shadow-sm text-slate-600"
                  >
                    <Upload className="w-4 h-4" />
                    Cập nhật đề cương
                  </button>
                  {state.quizData && (
                    <button
                      onClick={startQuiz}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                    >
                      <GraduationCap className="w-4 h-4" />
                      Làm trắc nghiệm ({state.quizData.questions.length} câu)
                    </button>
                  )}
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 prose prose-slate max-w-none relative">
                {user && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    <Database className="w-3 h-3" />
                    Đã lưu CSDL
                  </div>
                )}
                <ReactMarkdown>{state.studyContent?.content || ''}</ReactMarkdown>
              </div>
            </motion.div>
          )}

          {state.view === 'quiz' && state.quizData && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider">
                    Câu hỏi {state.currentQuestionIndex + 1} / {state.quizData.questions.length}
                  </span>
                  <span className="text-sm text-slate-500">
                    Môn: {state.selectedSubject}
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${((state.currentQuestionIndex + 1) / state.quizData.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-8">
                <h4 className="text-xl font-bold leading-relaxed text-slate-800">
                  {state.quizData.questions[state.currentQuestionIndex].question}
                </h4>

                <div className="grid gap-4">
                  {state.quizData.questions[state.currentQuestionIndex].options.map((option, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 10 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswerSelect(idx)}
                      className="group flex items-center gap-4 p-5 text-left bg-slate-50 hover:bg-indigo-50 border-2 border-slate-100 hover:border-indigo-200 rounded-2xl transition-all"
                    >
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-600 font-bold shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-900">{option}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {state.view === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 space-y-8 text-center">
                <div className="relative inline-block">
                  <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
                    <GraduationCap className="w-16 h-16 text-indigo-600" />
                  </div>
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="absolute -top-2 -right-2 bg-emerald-500 text-white p-2 rounded-full shadow-lg"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-900">Hoàn thành!</h3>
                  <p className="text-slate-500">Bạn đã hoàn thành bài ôn tập môn {state.selectedSubject}</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl max-w-xs mx-auto">
                  <div className="text-5xl font-black text-indigo-600 mb-1">
                    {state.score} / {state.quizData?.questions.length}
                  </div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Điểm số của bạn</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setState(prev => ({ ...prev, view: 'quiz', currentQuestionIndex: 0, userAnswers: [], score: 0 }))}
                    className="py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Làm lại bài tập
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, view: 'study' }))}
                    className="py-4 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl transition-all"
                  >
                    Xem lại nội dung ôn tập
                  </button>
                  <button
                    onClick={resetApp}
                    className="md:col-span-2 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                  >
                    Về trang chủ
                  </button>
                </div>

                {/* Review Section */}
                <div className="pt-8 text-left space-y-6">
                  <h4 className="text-xl font-bold border-b pb-2">Xem lại đáp án</h4>
                  {state.quizData?.questions.map((q, idx) => {
                    const userAnswer = state.userAnswers[idx];
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                      <div key={idx} className={cn(
                        "p-4 rounded-2xl border-2",
                        isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                      )}>
                        <p className="font-bold mb-2">{idx + 1}. {q.question}</p>
                        <div className="space-y-1 text-sm">
                          <p className={cn(isCorrect ? "text-emerald-700" : "text-red-700")}>
                            Đáp án của bạn: {q.options[userAnswer]}
                          </p>
                          {!isCorrect && (
                            <p className="text-emerald-700 font-bold">
                              Đáp án đúng: {q.options[q.correctAnswer]}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="mt-2 text-slate-600 italic">
                              <span className="font-bold not-italic">Giải thích:</span> {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-sm">
        <p>© 2026 Học Tốt Lớp 6 • Ứng dụng hỗ trợ học tập thông minh</p>
      </footer>
    </div>
  );
}
