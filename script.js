"use strict";

// Wrapped in a function so none of these names can shadow browser globals
// (a top-level `const performance` used to break the score animation).
(function () {
  const ROUND_TYPES = Object.freeze(["price", "scale", "human", "crowd", "time"]);
  const QUESTION_BANK_VERSION = 1;
  const DAILY_GAME_EPOCH = "2026-10-02";
  const SHARE_URL = "https://joshuat09.github.io/guessed/";
  const RESULT_ICONS = { price: "💷", scale: "📏", human: "🧠", crowd: "👥", time: "⏳" };
  const SUBMIT_LABELS = { price: "SUBMIT GUESS ", scale: "LOCK IN ", human: "LOCK IN ", crowd: "PREDICT THE CROWD ", time: "LOCK IN " };
  // Score thresholds, highest first. The last entry is the fallback.
  const SCORE_MESSAGES = {
    time: [[90, "TIME LORD ⏳"], [75, "GOOD SENSE OF TIME"], [50, "NOT TOO FAR OFF"], [25, "TIME IS HARD"], [0, "YOU LOST TRACK OF HISTORY 😂"]],
    crowd: [[90, "YOU READ THE CROWD 👀"], [75, "GOOD READ"], [50, "YOU WERE CLOSE"], [25, "THE CROWD DISAGREED"], [0, "YOU WENT ROGUE 😂"]],
    human: [[90, "YOU KNOW PEOPLE 👀"], [75, "PRETTY GOOD"], [50, "NOT BAD"], [25, "PEOPLE ARE WEIRD"], [0, "YOU HAVE NO IDEA 😂"]],
    default: [[95, "UNBELIEVABLY CLOSE"], [85, "VERY CLOSE"], [70, "NOT BAD 👀"], [50, "COULD BE WORSE"], [25, "YOUR INTUITION NEEDS WORK"], [0, "ABSOLUTELY NOWHERE NEAR"]]
  };

  const $ = (id) => document.getElementById(id);

  /* ---------- Daily game ---------- */

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
    return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(epochYear, epochMonth - 1, epochDay)) / 86400000) + 1;
  }

  const dailyLabel = (dateKey) => `GUESSED #${String(getDailyGameNumber(dateKey)).padStart(3, "0")}`;

  function hashDailySelection(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getQuestionBank(type) {
    return (window.GUESSED && window.GUESSED.questionBank && window.GUESSED.questionBank[type]) || [];
  }

  function getDailyQuestion(type, dateKey) {
    const bank = getQuestionBank(type);
    if (bank.length === 0) {
      console.error(`[GUESSED] No questions are available for ${type}.`);
      return null;
    }
    return bank[hashDailySelection(`${dateKey}|${QUESTION_BANK_VERSION}|${type}`) % bank.length] || null;
  }

  function shuffled(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  /* ---------- State ---------- */

  let questions = [];
  let currentQuestion = 0;
  let totalScore = 0;
  let roundResults = [];
  let selectedCrowdOption = null;
  let dailyDateKey = null;
  let gameMode = null;

  /* ---------- Elements ---------- */

  const screens = ["home-screen", "question-screen", "result-screen", "final-screen"].map($);
  const [homeScreen, questionScreen, resultScreen, finalScreen] = screens;
  const startButton = $("start-button");
  const submitButton = $("submit-button");
  const nextButton = $("next-button");
  const playAgainButton = $("play-again");
  const copyResultButton = $("copy-result");
  const homeDailyNumberDisplay = $("home-daily-number");

  // Question inputs
  const priceInputLabel = $("price-input-label");
  const priceArea = document.querySelector(".answer-area");
  const answerInput = $("answer-input");
  const scaleInput = $("scale-input");
  const scaleSlider = $("scale-slider");
  const scaleEstimate = $("scale-estimate");
  const scaleMin = $("scale-min");
  const scaleMax = $("scale-max");
  const humanInput = $("human-input");
  const humanAnswerInput = $("human-answer-input");
  const humanDataNote = $("human-data-note");
  const crowdInput = $("crowd-input");
  const crowdOptions = $("crowd-options");
  const timeInput = $("time-input");
  const timeSlider = $("time-slider");
  const timeEstimate = $("time-estimate");
  const timeMinLabel = $("time-min-label");
  const timeMaxLabel = $("time-max-label");
  const inputPanels = {
    price: [priceInputLabel, priceArea],
    scale: [scaleInput],
    human: [humanInput, humanDataNote],
    crowd: [crowdInput],
    time: [timeInput]
  };

  // Question and result screens
  const questionNumber = $("question-number");
  const resultQuestionNumber = $("result-question-number");
  const progressCaption = $("progress-caption");
  const progressFill = $("progress-fill");
  const category = $("category");
  const question = $("question");
  const guessBlock = $("guess-block");
  const actualBlock = $("actual-block");
  const revealConnector = $("reveal-connector");
  const yourAnswer = $("your-answer");
  const actualAnswer = $("actual-answer");
  const resultCategory = $("result-category");
  const crowdResults = $("crowd-results");
  const crowdResultList = $("crowd-result-list");
  const crowdPick = $("crowd-pick");
  const crowdTopPick = $("crowd-top-pick");
  const timeResult = $("time-result");
  const timeResultMin = $("time-result-min");
  const timeResultMax = $("time-result-max");
  const timeActualMarker = $("time-actual-marker");
  const timeGuessMarker = $("time-guess-marker");
  const timeActualYear = $("time-actual-year");
  const timeGuessYear = $("time-guess-year");
  const scoreDisplay = $("score");
  const scoreMessage = $("score-message");

  // Final screen
  const dailyGameNumberDisplay = $("daily-game-number");
  const finalScore = $("final-score");
  const scoreMaximum = $("score-maximum");
  const averageScore = $("average-score");
  const categoryScoreList = $("category-score-list");

  /* ---------- Helpers ---------- */

  const gameLabel = () => (gameMode ? `${gameMode.toUpperCase()} MODE` : dailyLabel(dailyDateKey || getDailyDateKey()));

  // preventScroll keeps the embedding page (the portfolio) from jumping when a field is focused.
  function focusSoon(element) {
    requestAnimationFrame(() => element && element.focus({ preventScroll: true }));
  }

  function showScreen(screen) {
    screens.forEach((item) => item.classList.toggle("active", item === screen));
    document.body.dataset.scene = screen.id;
    if (screen !== resultScreen) delete document.body.dataset.celebration;
    window.scrollTo(0, 0);
  }

  function formatValue(value, item) {
    if (item.type === "human") return `${Math.round(value)}%`;
    if (item.type === "time") return String(Math.round(value));
    return item.type === "price" ? `£${value.toFixed(2)}` : `${Math.round(value)} ${item.unit}`;
  }

  /* ---------- Sliders and time result ---------- */

  function updateScaleEstimate() {
    scaleEstimate.textContent = `${scaleSlider.value} ${questions[currentQuestion].unit}`;
  }

  function updateTimeEstimate() {
    timeEstimate.textContent = timeSlider.value;
  }

  function renderTimeResult(item, guess) {
    const range = item.max - item.min;
    timeResultMin.textContent = String(item.min);
    timeResultMax.textContent = String(item.max);
    timeActualYear.textContent = String(item.answer);
    timeGuessYear.textContent = String(guess);
    timeActualMarker.style.left = `${((item.answer - item.min) / range) * 100}%`;
    timeGuessMarker.style.left = `${((guess - item.min) / range) * 100}%`;
    timeResult.setAttribute("aria-label", `Timeline from ${item.min} to ${item.max}: actual year ${item.answer}; your guess ${guess}`);
    timeResult.hidden = false;
  }

  /* ---------- Crowd questions ---------- */

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

  function onCrowdOptionKey(event, button) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const buttons = [...crowdOptions.querySelectorAll("[role='radio']")];
    const index = buttons.indexOf(button);
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const target = buttons[
      event.key === "Home" ? 0
        : event.key === "End" ? buttons.length - 1
          : (index + (forward ? 1 : -1) + buttons.length) % buttons.length
    ];
    selectCrowdOption(target.dataset.optionId);
    target.focus();
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
      button.addEventListener("keydown", (event) => onCrowdOptionKey(event, button));
      crowdOptions.append(button);
    });
  }

  function getCrowdTopOption(item) {
    return item.options.reduce((top, option) => (item.crowdDistribution[option.id] > item.crowdDistribution[top.id] ? option : top), item.options[0]);
  }

  function calculateCrowdScore(item, optionId) {
    const topPercentage = Math.max(...item.options.map((option) => item.crowdDistribution[option.id]));
    return Math.round(Math.max(0, Math.min(100, (item.crowdDistribution[optionId] / topPercentage) * 100)));
  }

  function renderCrowdResults(item, selectedId) {
    const topOption = getCrowdTopOption(item);
    const sortedOptions = [...item.options].sort((a, b) => item.crowdDistribution[b.id] - item.crowdDistribution[a.id]);
    crowdResultList.replaceChildren();
    sortedOptions.forEach((option) => {
      const percentage = item.crowdDistribution[option.id];
      const isTop = option.id === topOption.id;
      const row = document.createElement("div");
      row.className = `crowd-result-row${isTop ? " is-top" : ""}`;
      row.setAttribute("aria-label", `${option.label}: ${percentage}%${isTop ? ", crowd's top pick" : ""}`);
      const heading = document.createElement("div");
      heading.className = "crowd-result-heading";
      const name = document.createElement("span");
      name.className = "crowd-result-name";
      name.textContent = `${option.emoji} ${option.label}`;
      heading.append(name);
      if (isTop) {
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
  }

  /* ---------- Loading a question ---------- */

  function loadQuestion() {
    const item = questions[currentQuestion];
    progressCaption.textContent = gameMode ? `${gameMode.toUpperCase()} MODE` : "DAILY 5";
    questionNumber.textContent = `${currentQuestion + 1} / ${questions.length}`;
    resultQuestionNumber.textContent = questionNumber.textContent;
    progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
    category.textContent = item.category;
    question.textContent = item.question;

    Object.entries(inputPanels).forEach(([type, elements]) => elements.forEach((element) => { element.hidden = type !== item.type; }));
    submitButton.disabled = item.type === "crowd";
    submitButton.firstChild.textContent = SUBMIT_LABELS[item.type];
    selectedCrowdOption = null;

    switch (item.type) {
      case "scale":
        scaleSlider.min = String(item.min);
        scaleSlider.max = String(item.max);
        scaleSlider.value = "0";
        scaleSlider.disabled = false;
        scaleSlider.setAttribute("aria-label", `Your estimate in ${item.unit}`);
        scaleMin.textContent = `${item.min} ${item.unit}`;
        scaleMax.textContent = `${item.max} ${item.unit}`;
        updateScaleEstimate();
        focusSoon(scaleSlider);
        break;
      case "human":
        humanAnswerInput.value = "";
        humanAnswerInput.setCustomValidity("");
        focusSoon(humanAnswerInput);
        break;
      case "crowd":
        renderCrowdOptions(item);
        focusSoon(crowdOptions.querySelector("[role='radio']"));
        break;
      case "time":
        timeSlider.min = String(item.min);
        timeSlider.max = String(item.max);
        timeSlider.step = "1";
        timeSlider.value = String(Math.round((item.min + item.max) / 2));
        timeSlider.disabled = false;
        timeSlider.setAttribute("aria-label", `Choose a year from ${item.min} to ${item.max}`);
        timeMinLabel.textContent = String(item.min);
        timeMaxLabel.textContent = String(item.max);
        updateTimeEstimate();
        focusSoon(timeSlider);
        break;
      default:
        answerInput.value = "";
        answerInput.setCustomValidity("");
        focusSoon(answerInput);
    }
  }

  /* ---------- Scoring ---------- */

  function calculateScore(guess, actual, type, item) {
    const denominator = type === "human" ? Math.max(actual, 1) : type === "time" ? Math.max(item.max - item.min, 1) : actual;
    const percentageError = Math.abs(guess - actual) / denominator;
    return Math.round(Math.max(0, Math.min(100, 100 - percentageError * 100)));
  }

  function getScoreMessage(value, type) {
    const thresholds = SCORE_MESSAGES[type] || SCORE_MESSAGES.default;
    return (thresholds.find(([minimum]) => value >= minimum) || thresholds[thresholds.length - 1])[1];
  }

  function animateScore(target) {
    scoreDisplay.classList.remove("pop");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scoreDisplay.textContent = String(target);
      return;
    }
    const duration = 850;
    let startedAt = null;
    scoreDisplay.textContent = "0";
    requestAnimationFrame(() => scoreDisplay.classList.add("pop"));
    function tick(now) {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / duration, 1);
      scoreDisplay.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Submitting a guess ---------- */

  // Returns the guess, or null after showing a validation message.
  function readGuess(item) {
    if (item.type === "crowd") return selectedCrowdOption;
    const input = { scale: scaleSlider, human: humanAnswerInput, time: timeSlider }[item.type] || answerInput;
    const raw = String(input.value);
    const guess = Number(raw);
    const invalid = item.type === "human"
      ? raw.trim() === "" || !Number.isInteger(guess) || guess < 0 || guess > 100
      : !Number.isFinite(guess) || (item.type === "price" && guess <= 0);
    if (!invalid) return guess;
    input.setCustomValidity(item.type === "human" ? "Enter a whole percentage from 0 to 100." : "Enter a price greater than zero.");
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return null;
  }

  function submitGuess() {
    const item = questions[currentQuestion];
    const guess = readGuess(item);
    if (guess === null) return;

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
      if (item.type === "time") renderTimeResult(item, guess);
    }
    resultCategory.textContent = item.type === "price" ? "ACTUAL PRICE" : item.type === "human" ? "ACTUAL · DEVELOPMENT DATA" : "ACTUAL";
    scoreMessage.textContent = getScoreMessage(questionScore, item.type);
    document.body.dataset.celebration = questionScore >= 85 ? "high" : questionScore >= 50 ? "close" : "low";

    showScreen(resultScreen);
    animateScore(questionScore);
    const isLast = currentQuestion === questions.length - 1;
    nextButton.innerHTML = isLast ? 'SEE RESULTS <span aria-hidden="true">→</span>' : 'NEXT <span aria-hidden="true">→</span>';
    nextButton.focus({ preventScroll: true });
  }

  /* ---------- Finishing and starting ---------- */

  function finishGame() {
    dailyGameNumberDisplay.textContent = gameLabel();
    scoreMaximum.textContent = String(questions.length * 100);
    finalScore.textContent = String(totalScore);
    averageScore.textContent = String(Math.round(totalScore / questions.length));

    const categoryScores = {};
    roundResults.forEach((result) => {
      (categoryScores[result.category] = categoryScores[result.category] || []).push(result.score);
    });
    categoryScoreList.replaceChildren();
    categoryScoreList.classList.toggle("single-score", Boolean(gameMode));
    (gameMode ? [gameMode] : ROUND_TYPES).forEach((type) => {
      const name = type.toUpperCase();
      const scores = categoryScores[name];
      if (!scores || scores.length === 0) return;
      const card = document.createElement("div");
      card.className = "category-score";
      const label = document.createElement("span");
      label.textContent = name;
      const value = document.createElement("strong");
      value.textContent = String(Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length));
      card.append(label, value);
      categoryScoreList.append(card);
    });
    showScreen(finalScreen);
  }

  function startGame(dateKey = getDailyDateKey()) {
    dailyDateKey = dateKey;
    questions = gameMode
      ? shuffled(getQuestionBank(gameMode))
      : ROUND_TYPES.map((type) => getDailyQuestion(type, dailyDateKey)).filter(Boolean);
    if (questions.length === 0) {
      console.error("[GUESSED] The question bank did not load.");
      return;
    }
    currentQuestion = 0;
    totalScore = 0;
    roundResults = [];
    selectedCrowdOption = null;
    showScreen(questionScreen);
    loadQuestion();
  }

  function startDailyGame() {
    gameMode = null;
    startGame(getDailyDateKey());
  }

  function startModeGame(type) {
    if (!ROUND_TYPES.includes(type)) return;
    gameMode = type;
    startGame(dailyDateKey || getDailyDateKey());
  }

  function returnHome() {
    homeDailyNumberDisplay.textContent = dailyLabel(getDailyDateKey());
    showScreen(homeScreen);
  }

  function goToNext() {
    currentQuestion += 1;
    if (currentQuestion >= questions.length) {
      finishGame();
      return;
    }
    showScreen(questionScreen);
    loadQuestion();
  }

  /* ---------- Sharing ---------- */

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // fall through to the legacy method
      }
    }
    let temporary;
    try {
      temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      if (temporary) temporary.remove();
    }
  }

  async function copyResult() {
    const lines = roundResults.map((result) => `${RESULT_ICONS[result.type]} ${result.score}`);
    const text = `${gameLabel()}\n\n${totalScore}/${questions.length * 100}\n\n${lines.join("\n")}\n\nPlay GUESSED:\n${SHARE_URL}`;
    if (await copyToClipboard(text)) {
      copyResultButton.textContent = "COPIED!";
    } else {
      try {
        window.prompt("Copy your spoiler-free result:", text);
      } catch (error) {
        console.warn("[GUESSED] Could not copy the result.", error);
      }
    }
    window.setTimeout(() => { copyResultButton.textContent = "COPY RESULT"; }, 1800);
  }

  /* ---------- Wiring ---------- */

  const submitOnEnter = (event) => { if (event.key === "Enter") submitGuess(); };

  homeDailyNumberDisplay.textContent = dailyLabel(getDailyDateKey());
  startButton.addEventListener("click", startDailyGame);
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => startModeGame(button.dataset.mode)));
  playAgainButton.addEventListener("click", () => startGame(dailyDateKey || getDailyDateKey()));
  submitButton.addEventListener("click", submitGuess);
  nextButton.addEventListener("click", goToNext);
  copyResultButton.addEventListener("click", copyResult);
  ["game-home-button", "result-home-button", "final-home-button"].forEach((id) => $(id).addEventListener("click", returnHome));
  scaleSlider.addEventListener("input", updateScaleEstimate);
  timeSlider.addEventListener("input", updateTimeEstimate);
  [answerInput, humanAnswerInput, scaleSlider, timeSlider].forEach((input) => input.addEventListener("keydown", submitOnEnter));
})();
