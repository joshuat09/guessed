const ROUND_TYPES = Object.freeze(["price", "scale", "human", "crowd", "time"]);
const QUESTION_BANK_VERSION = 1;
const DAILY_GAME_EPOCH = "2026-10-02";

function getDailyDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDailyGameNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [epochYear, epochMonth, epochDay] = DAILY_GAME_EPOCH.split("-").map(Number);
  const date = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(epochYear, epochMonth - 1, epochDay);
  return Math.floor((date - epoch) / 86400000) + 1;
}

function hashDailySelection(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDailyQuestion(type, dateKey) {
  const bank = window.GUESSED && window.GUESSED.questionBank && window.GUESSED.questionBank[type];
  if (!Array.isArray(bank) || bank.length === 0) {
    console.error(`[GUESSED] No questions are available for ${type}.`);
    return null;
  }
  const seed = `${dateKey}|${QUESTION_BANK_VERSION}|${type}`;
  const questionIndex = hashDailySelection(seed) % bank.length;
  return bank[questionIndex] || null;
}

let questions = [];
let currentQuestion = 0;
let totalScore = 0;
let roundResults = [];
let selectedCrowdOption = null;
let dailyDateKey = null;
let dailyQuestionIds = [];
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
const crowdInput = document.getElementById("crowd-input");
const crowdOptions = document.getElementById("crowd-options");
const crowdResults = document.getElementById("crowd-results");
const crowdResultList = document.getElementById("crowd-result-list");
const guessBlock = document.getElementById("guess-block");
const actualBlock = document.getElementById("actual-block");
const revealConnector = document.getElementById("reveal-connector");
const crowdPick = document.getElementById("crowd-pick");
const crowdTopPick = document.getElementById("crowd-top-pick");
const timeInput = document.getElementById("time-input");
const timeSlider = document.getElementById("time-slider");
const timeEstimate = document.getElementById("time-estimate");
const timeMinLabel = document.getElementById("time-min-label");
const timeMaxLabel = document.getElementById("time-max-label");
const timeResult = document.getElementById("time-result");
const timeResultMin = document.getElementById("time-result-min");
const timeResultMax = document.getElementById("time-result-max");
const timeActualMarker = document.getElementById("time-actual-marker");
const timeGuessMarker = document.getElementById("time-guess-marker");
const timeActualYear = document.getElementById("time-actual-year");
const timeGuessYear = document.getElementById("time-guess-year");
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
const dailyGameNumberDisplay = document.getElementById("daily-game-number");
const percentile = document.getElementById("percentile");
const categoryScoreList = document.getElementById("category-score-list");

function showScreen(screen) {
  screens.forEach((item) => item.classList.toggle("active", item === screen));
  document.body.dataset.scene = screen.id;
  if (screen !== screens[2]) delete document.body.dataset.celebration;
}

function formatValue(value, item) {
  if (item.type === "human") return `${Math.round(value)}%`;
  if (item.type === "time") return String(Math.round(value));
  return item.type === "price" ? `£${value.toFixed(2)}` : `${Math.round(value)} ${item.unit}`;
}

function updateScaleEstimate() {
  const item = questions[currentQuestion];
  scaleEstimate.textContent = `${scaleSlider.value} ${item.unit}`;
}

function updateTimeEstimate() {
  timeEstimate.textContent = timeSlider.value;
}

function renderTimeResult(item, guess) {
  const range = item.max - item.min;
  const actualPosition = ((item.answer - item.min) / range) * 100;
  const guessPosition = ((guess - item.min) / range) * 100;
  timeResultMin.textContent = String(item.min);
  timeResultMax.textContent = String(item.max);
  timeActualYear.textContent = String(item.answer);
  timeGuessYear.textContent = String(guess);
  timeActualMarker.style.left = `${actualPosition}%`;
  timeGuessMarker.style.left = `${guessPosition}%`;
  timeResult.setAttribute("aria-label", `Timeline from ${item.min} to ${item.max}: actual year ${item.answer}; your guess ${guess}`);
  timeResult.hidden = false;
}

function selectCrowdOption(optionId) {
  selectedCrowdOption = optionId;
  crowdOptions.querySelectorAll("[role='radio']").forEach((button) => {
    const isSelected = button.dataset.optionId === optionId;
    button.setAttribute("aria-checked", String(isSelected));
    button.classList.toggle("selected", isSelected);
    button.tabIndex = isSelected ? 0 : -1;
  });
  submitButton.disabled = false;
}

function renderCrowdOptions(item) {
  crowdOptions.replaceChildren();
  item.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "crowd-option";
    button.dataset.optionId = option.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.tabIndex = index === 0 ? 0 : -1;
    const emoji = document.createElement("span");
    emoji.className = "crowd-option-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = option.emoji;
    const label = document.createElement("span");
    label.className = "crowd-option-label";
    label.textContent = option.label;
    button.append(emoji, label);
    button.addEventListener("click", () => selectCrowdOption(option.id));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...crowdOptions.querySelectorAll("[role='radio']")];
      const currentIndex = buttons.indexOf(button);
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (currentIndex + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      const nextButton = buttons[nextIndex];
      selectCrowdOption(nextButton.dataset.optionId);
      nextButton.focus();
    });
    crowdOptions.append(button);
  });
}

function getCrowdTopOption(item) {
  return item.options.reduce((top, option) => item.crowdDistribution[option.id] > item.crowdDistribution[top.id] ? option : top, item.options[0]);
}

function calculateCrowdScore(item, optionId) {
  const topPercentage = Math.max(...item.options.map((option) => item.crowdDistribution[option.id]));
  const selectedPercentage = item.crowdDistribution[optionId];
  return Math.round(Math.max(0, Math.min(100, selectedPercentage / topPercentage * 100)));
}

function renderCrowdResults(item, selectedId) {
  const sortedOptions = [...item.options].sort((a, b) => item.crowdDistribution[b.id] - item.crowdDistribution[a.id]);
  const topOption = getCrowdTopOption(item);
  crowdResultList.replaceChildren();
  sortedOptions.forEach((option) => {
    const percentage = item.crowdDistribution[option.id];
    const row = document.createElement("div");
    row.className = `crowd-result-row${option.id === topOption.id ? " is-top" : ""}`;
    row.setAttribute("aria-label", `${option.label}: ${percentage}%${option.id === topOption.id ? ", crowd's top pick" : ""}`);
    const heading = document.createElement("div");
    heading.className = "crowd-result-heading";
    const name = document.createElement("span");
    name.className = "crowd-result-name";
    name.textContent = `${option.emoji} ${option.label}`;
    heading.append(name);
    if (option.id === topOption.id) {
      const badge = document.createElement("span");
      badge.className = "crowd-leader-badge";
      badge.textContent = "TOP PICK";
      heading.append(badge);
    }
    const value = document.createElement("strong");
    value.className = "crowd-result-value";
    value.textContent = `${percentage}%`;
    heading.append(value);
    const track = document.createElement("div");
    track.className = "crowd-bar-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("span");
    bar.className = "crowd-bar-fill";
    bar.style.width = `${percentage}%`;
    track.append(bar);
    row.append(heading, track);
    crowdResultList.append(row);
  });
  const selected = item.options.find((option) => option.id === selectedId);
  crowdPick.textContent = `${selected.emoji} ${selected.label}`;
  crowdTopPick.textContent = `${topOption.emoji} ${topOption.label}`;
  crowdInput.hidden = true;
  guessBlock.hidden = true;
  actualBlock.hidden = true;
  revealConnector.hidden = true;
  crowdResults.hidden = false;
  return { topOption, selectedOption: selected };
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
  const isCrowd = item.type === "crowd";
  const isTime = item.type === "time";
  priceInputLabel.hidden = !isPrice;
  priceArea.hidden = !isPrice;
  scaleInput.hidden = !isScale;
  humanInput.hidden = !isHuman;
  humanDataNote.hidden = !isHuman;
  crowdInput.hidden = !isCrowd;
  timeInput.hidden = !isTime;
  submitButton.disabled = isCrowd;
  submitButton.firstChild.textContent = isCrowd ? "PREDICT THE CROWD " : isScale || isHuman || isTime ? "LOCK IN " : "SUBMIT GUESS ";
  selectedCrowdOption = null;
  if (isScale) {
    scaleSlider.min = String(item.min);
    scaleSlider.max = String(item.max);
    scaleSlider.value = "0";
    scaleSlider.disabled = false;
    scaleSlider.setAttribute("aria-label", `Your estimate in ${item.unit}`);
    scaleMin.textContent = `${item.min} ${item.unit}`;
    scaleMax.textContent = `${item.max} ${item.unit}`;
    updateScaleEstimate();
    requestAnimationFrame(() => scaleSlider.focus());
  } else if (isHuman) {
    humanAnswerInput.value = "";
    humanAnswerInput.setCustomValidity("");
    requestAnimationFrame(() => humanAnswerInput.focus());
  } else if (isCrowd) {
    renderCrowdOptions(item);
    requestAnimationFrame(() => crowdOptions.querySelector("[role='radio']")?.focus());
  } else if (isTime) {
    timeSlider.min = String(item.min);
    timeSlider.max = String(item.max);
    timeSlider.step = "1";
    timeSlider.value = String(Math.round((item.min + item.max) / 2));
    timeSlider.disabled = false;
    timeSlider.setAttribute("aria-label", `Choose a year from ${item.min} to ${item.max}`);
    timeMinLabel.textContent = String(item.min);
    timeMaxLabel.textContent = String(item.max);
    updateTimeEstimate();
    requestAnimationFrame(() => timeSlider.focus());
  } else {
    answerInput.value = "";
    requestAnimationFrame(() => answerInput.focus());
  }
}

function calculateScore(guess, actual, type, item = questions[currentQuestion]) {
  const denominator = type === "human" ? Math.max(actual, 1) : type === "time" ? Math.max(item.max - item.min, 1) : actual;
  const percentageError = Math.abs(guess - actual) / denominator;
  return Math.round(Math.max(0, Math.min(100, 100 - percentageError * 100)));
}

function getScoreMessage(value, type) {
  if (type === "time") {
    if (value >= 90) return "TIME LORD ⏳";
    if (value >= 75) return "GOOD SENSE OF TIME";
    if (value >= 50) return "NOT TOO FAR OFF";
    if (value >= 25) return "TIME IS HARD";
    return "YOU LOST TRACK OF HISTORY 😂";
  }
  if (type === "crowd") {
    if (value >= 90) return "YOU READ THE CROWD 👀";
    if (value >= 75) return "GOOD READ";
    if (value >= 50) return "YOU WERE CLOSE";
    if (value >= 25) return "THE CROWD DISAGREED";
    return "YOU WENT ROGUE 😂";
  }
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
  if (item.type === "crowd" && !selectedCrowdOption) return;
  const input = item.type === "scale" ? scaleSlider : item.type === "human" ? humanAnswerInput : item.type === "time" ? timeSlider : answerInput;
  const rawGuess = String(input.value);
  const guess = item.type === "crowd" ? selectedCrowdOption : Number(rawGuess);
  const invalidHuman = item.type === "human" && (rawGuess.trim() === "" || !Number.isInteger(guess) || guess < 0 || guess > 100);
  if (item.type !== "crowd" && (!Number.isFinite(guess) || (item.type === "price" && guess <= 0) || invalidHuman)) {
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
  const questionScore = item.type === "crowd" ? calculateCrowdScore(item, guess) : calculateScore(guess, item.answer, item.type, item);
  totalScore += questionScore;
  roundResults.push({ questionId: item.id, type: item.type, category: item.category, score: questionScore });
  if (item.type === "scale") scaleSlider.disabled = true;
  if (item.type === "crowd") {
    renderCrowdResults(item, guess);
  } else {
    crowdResults.hidden = true;
    timeResult.hidden = item.type !== "time";
    guessBlock.hidden = false;
    actualBlock.hidden = false;
    revealConnector.hidden = false;
    actualAnswer.textContent = formatValue(item.answer, item);
    yourAnswer.textContent = formatValue(guess, item);
    if (item.type === "time") {
      resultCategory.textContent = "ACTUAL";
      renderTimeResult(item, guess);
    }
  }
  resultCategory.textContent = item.type === "price" ? "ACTUAL PRICE" : item.type === "human" ? "ACTUAL · DEVELOPMENT DATA" : "ACTUAL";
  scoreMessage.textContent = getScoreMessage(questionScore, item.type);
  document.body.dataset.celebration = questionScore >= 85 ? "high" : questionScore >= 50 ? "close" : "low";
  showScreen(screens[2]);
  animateScore(questionScore);
  nextButton.focus();
}

function finishGame() {
  dailyGameNumberDisplay.textContent = `GUESSED #${String(getDailyGameNumber(dailyDateKey)).padStart(3, "0")}`;
  finalScore.textContent = String(totalScore);
  const averageScore = totalScore / questions.length;
  percentile.textContent = `${Math.min(99, Math.max(1, Math.round(averageScore * 0.85)))}%`;
  const categoryScores = roundResults.reduce((scores, result) => {
    if (!scores[result.category]) scores[result.category] = [];
    scores[result.category].push(result.score);
    return scores;
  }, {});
  categoryScoreList.replaceChildren();
  ROUND_TYPES.forEach((type) => {
    const categoryName = type.toUpperCase();
    const scores = categoryScores[categoryName];
    if (!scores || scores.length === 0) return;
    const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
    const card = document.createElement("div");
    card.className = "category-score";
    const label = document.createElement("span");
    label.textContent = categoryName;
    const value = document.createElement("strong");
    value.textContent = String(score);
    card.append(label, value);
    categoryScoreList.append(card);
  });
  showScreen(screens[3]);
}

function startGame(dateKey = getDailyDateKey()) {
  dailyDateKey = dateKey;
  questions = ROUND_TYPES.map((type) => getDailyQuestion(type, dailyDateKey)).filter(Boolean);
  dailyQuestionIds = questions.map((item) => item.id);
  currentQuestion = 0;
  totalScore = 0;
  roundResults = [];
  selectedCrowdOption = null;
  showScreen(screens[1]);
  loadQuestion();
}

startButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", () => startGame(dailyDateKey || getDailyDateKey()));
submitButton.addEventListener("click", submitGuess);
scaleSlider.addEventListener("input", updateScaleEstimate);
timeSlider.addEventListener("input", updateTimeEstimate);
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
