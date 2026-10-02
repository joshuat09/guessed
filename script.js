const priceQuestions = [
  { type: "price", category: "PRICE", question: "How much does a weekly supermarket shop for two people cost?", answer: 86.42 },
  { type: "price", category: "PRICE", question: "How much does an average takeaway pizza cost?", answer: 14.50 },
  { type: "price", category: "PRICE", question: "How much does a pair of average running shoes cost?", answer: 95 },
  { type: "price", category: "PRICE", question: "How much does a cinema ticket cost on average?", answer: 12 },
  { type: "price", category: "PRICE", question: "How much does a three-course restaurant meal for two people cost?", answer: 75 }
];

// Initial game values; replace with researched, sourced measurements when ready.
const scaleQuestions = [
  { type: "scale", category: "SCALE", question: "How tall is the Eiffel Tower?", answer: 330, max: 500, unit: "m" },
  { type: "scale", category: "SCALE", question: "How high is Big Ben?", answer: 96, max: 150, unit: "m" },
  { type: "scale", category: "SCALE", question: "How long is an Olympic swimming pool?", answer: 50, max: 100, unit: "m" },
  { type: "scale", category: "SCALE", question: "How tall is the Statue of Liberty?", answer: 93, max: 150, unit: "m" },
  { type: "scale", category: "SCALE", question: "How long is a Boeing 747-8?", answer: 76, max: 120, unit: "m" }
];
// Placeholder development data only. Add verified source metadata before treating these as research.
const humanQuestions = [
  { type: "human", category: "HUMAN", question: "What percentage of people have Googled their own name?", answer: 42, unit: "%" },
  { type: "human", category: "HUMAN", question: "What percentage of people admit to talking to themselves?", answer: 57, unit: "%" },
  { type: "human", category: "HUMAN", question: "What percentage of people have pretended to understand something when they did not?", answer: 68, unit: "%" },
  { type: "human", category: "HUMAN", question: "What percentage of people check their phone within 10 minutes of waking up?", answer: 62, unit: "%" },
  { type: "human", category: "HUMAN", question: "What percentage of people have lied about being busy to avoid making plans?", answer: 41, unit: "%" }
];
const questions = [priceQuestions[0], scaleQuestions[0], humanQuestions[0], scaleQuestions[1], priceQuestions[2]];

let currentQuestion = 0;
let totalScore = 0;
let scoresByType = { price: [], scale: [], human: [] };
const screens = ["home-screen", "question-screen", "result-screen", "final-screen"].map((id) => document.getElementById(id));
const startButton = document.getElementById("start-button");
const submitButton = document.getElementById("submit-button");
const nextButton = document.getElementById("next-button");
const playAgainButton = document.getElementById("play-again");
const answerInput = document.getElementById("answer-input");
const priceInputLabel = document.getElementById("price-input-label");
const priceArea = document.querySelector(".answer-area");
const scaleInput = document.getElementById("scale-input");
const scaleSlider = document.getElementById("scale-slider");
const scaleEstimate = document.getElementById("scale-estimate");
const scaleMin = document.getElementById("scale-min");
const scaleMax = document.getElementById("scale-max");
const humanInput = document.getElementById("human-input");
const humanAnswerInput = document.getElementById("human-answer-input");
const humanDataNote = document.getElementById("human-data-note");
const questionNumber = document.getElementById("question-number");
const resultQuestionNumber = document.getElementById("result-question-number");
const progressFill = document.getElementById("progress-fill");
const category = document.getElementById("category");
const question = document.getElementById("question");
const actualAnswer = document.getElementById("actual-answer");
const yourAnswer = document.getElementById("your-answer");
const resultCategory = document.getElementById("result-category");
const scoreDisplay = document.getElementById("score");
const scoreMessage = document.getElementById("score-message");
const finalScore = document.getElementById("final-score");
const percentile = document.getElementById("percentile");
const priceScore = document.getElementById("price-score");
const scaleScore = document.getElementById("scale-score");
const humanScore = document.getElementById("human-score");

function showScreen(screen) {
  screens.forEach((item) => item.classList.toggle("active", item === screen));
  document.body.dataset.scene = screen.id;
  if (screen !== screens[2]) delete document.body.dataset.celebration;
}

function formatValue(value, item) {
  if (item.type === "human") return `${Math.round(value)}%`;
  return item.type === "price" ? `£${value.toFixed(2)}` : `${Math.round(value)} ${item.unit}`;
}

function updateScaleEstimate() {
  const item = questions[currentQuestion];
  scaleEstimate.textContent = `${scaleSlider.value} ${item.unit}`;
}

function loadQuestion() {
  const item = questions[currentQuestion];
  questionNumber.textContent = `${currentQuestion + 1} / ${questions.length}`;
  resultQuestionNumber.textContent = questionNumber.textContent;
  progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
  category.textContent = item.category;
  question.textContent = item.question;
  const isPrice = item.type === "price";
  const isScale = item.type === "scale";
  const isHuman = item.type === "human";
  priceInputLabel.hidden = !isPrice;
  priceArea.hidden = !isPrice;
  scaleInput.hidden = !isScale;
  humanInput.hidden = !isHuman;
  humanDataNote.hidden = !isHuman;
  submitButton.firstChild.textContent = isScale || isHuman ? "LOCK IN " : "SUBMIT GUESS ";
  if (isScale) {
    scaleSlider.min = "0";
    scaleSlider.max = String(item.max);
    scaleSlider.value = "0";
    scaleSlider.disabled = false;
    scaleSlider.setAttribute("aria-label", `Your estimate in ${item.unit}`);
    scaleMin.textContent = `0 ${item.unit}`;
    scaleMax.textContent = `${item.max} ${item.unit}`;
    updateScaleEstimate();
    requestAnimationFrame(() => scaleSlider.focus());
  } else if (isHuman) {
    humanAnswerInput.value = "";
    humanAnswerInput.setCustomValidity("");
    requestAnimationFrame(() => humanAnswerInput.focus());
  } else {
    answerInput.value = "";
    requestAnimationFrame(() => answerInput.focus());
  }
}

function calculateScore(guess, actual, type) {
  const percentageError = Math.abs(guess - actual) / (type === "human" ? Math.max(actual, 1) : actual);
  return Math.round(Math.max(0, Math.min(100, 100 - percentageError * 100)));
}

function getScoreMessage(value, type) {
  if (type === "human") {
    if (value >= 90) return "YOU KNOW PEOPLE 👀";
    if (value >= 75) return "PRETTY GOOD";
    if (value >= 50) return "NOT BAD";
    if (value >= 25) return "PEOPLE ARE WEIRD";
    return "YOU HAVE NO IDEA 😂";
  }
  if (value >= 95) return "UNBELIEVABLY CLOSE";
  if (value >= 85) return "VERY CLOSE";
  if (value >= 70) return "NOT BAD 👀";
  if (value >= 50) return "COULD BE WORSE";
  if (value >= 25) return "YOUR INTUITION NEEDS WORK";
  return "ABSOLUTELY NOWHERE NEAR";
}

function animateScore(target) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    scoreDisplay.textContent = String(target);
    scoreDisplay.classList.remove("pop");
    return;
  }
  const duration = 850;
  const startedAt = performance.now();
  scoreDisplay.textContent = "0";
  scoreDisplay.classList.remove("pop");
  requestAnimationFrame(() => scoreDisplay.classList.add("pop"));
  function tick(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    scoreDisplay.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function submitGuess() {
  const item = questions[currentQuestion];
  const input = item.type === "scale" ? scaleSlider : item.type === "human" ? humanAnswerInput : answerInput;
  const rawGuess = input.value;
  const guess = Number(rawGuess);
  const invalidHuman = item.type === "human" && (rawGuess.trim() === "" || !Number.isInteger(guess) || guess < 0 || guess > 100);
  if (!Number.isFinite(guess) || (item.type === "price" && guess <= 0) || invalidHuman) {
    if (item.type === "human") {
      humanAnswerInput.setCustomValidity("Enter a whole percentage from 0 to 100.");
      humanAnswerInput.reportValidity();
      humanAnswerInput.addEventListener("input", () => humanAnswerInput.setCustomValidity(""), { once: true });
      return;
    }
    answerInput.setCustomValidity("Enter a price greater than zero.");
    answerInput.reportValidity();
    answerInput.addEventListener("input", () => answerInput.setCustomValidity(""), { once: true });
    return;
  }
  const questionScore = calculateScore(guess, item.answer, item.type);
  totalScore += questionScore;
  scoresByType[item.type].push(questionScore);
  if (item.type === "scale") scaleSlider.disabled = true;
  actualAnswer.textContent = formatValue(item.answer, item);
  yourAnswer.textContent = formatValue(guess, item);
  resultCategory.textContent = item.type === "price" ? "ACTUAL PRICE" : item.type === "human" ? "ACTUAL · DEVELOPMENT DATA" : "ACTUAL";
  scoreMessage.textContent = getScoreMessage(questionScore, item.type);
  document.body.dataset.celebration = questionScore >= 85 ? "high" : questionScore >= 50 ? "close" : "low";
  showScreen(screens[2]);
  animateScore(questionScore);
  nextButton.focus();
}

function finishGame() {
  finalScore.textContent = String(totalScore);
  const averageScore = totalScore / questions.length;
  percentile.textContent = `${Math.min(99, Math.max(1, Math.round(averageScore * 0.85)))}%`;
  const average = (list) => list.length ? String(Math.round(list.reduce((sum, value) => sum + value, 0) / list.length)) : "0";
  priceScore.textContent = average(scoresByType.price);
  scaleScore.textContent = average(scoresByType.scale);
  humanScore.textContent = average(scoresByType.human);
  showScreen(screens[3]);
}

function startGame() {
  currentQuestion = 0;
  totalScore = 0;
  scoresByType = { price: [], scale: [], human: [] };
  showScreen(screens[1]);
  loadQuestion();
}

startButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", startGame);
submitButton.addEventListener("click", submitGuess);
scaleSlider.addEventListener("input", updateScaleEstimate);
nextButton.addEventListener("click", () => {
  currentQuestion += 1;
  if (currentQuestion >= questions.length) return finishGame();
  showScreen(screens[1]);
  loadQuestion();
});
answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitGuess();
});
humanAnswerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitGuess();
});
