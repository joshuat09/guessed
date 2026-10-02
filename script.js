const questions = [
    {
        category: "PRICE",
        question: "How much does a weekly supermarket shop for two people cost?",
        answer: 86.42
    },
    {
        category: "PRICE",
        question: "How much does an average takeaway pizza cost?",
        answer: 14.50
    },
    {
        category: "PRICE",
        question: "How much does a pair of average running shoes cost?",
        answer: 95
    },
    {
        category: "PRICE",
        question: "How much does a cinema ticket cost on average?",
        answer: 12
    },
    {
        category: "PRICE",
        question: "How much does a three-course restaurant meal for two people cost?",
        answer: 75
    }
];

let currentQuestion = 0;
let totalScore = 0;
let currentGuess = 0;

const homeScreen = document.getElementById("home-screen");
const questionScreen = document.getElementById("question-screen");
const resultScreen = document.getElementById("result-screen");
const finalScreen = document.getElementById("final-screen");

const startButton = document.getElementById("start-button");
const submitButton = document.getElementById("submit-button");
const nextButton = document.getElementById("next-button");
const playAgainButton = document.getElementById("play-again");

const answerInput = document.getElementById("answer-input");

const questionNumber = document.getElementById("question-number");
const category = document.getElementById("category");
const question = document.getElementById("question");

const actualAnswer = document.getElementById("actual-answer");
const yourAnswer = document.getElementById("your-answer");
const score = document.getElementById("score");
const scoreMessage = document.getElementById("score-message");

const finalScore = document.getElementById("final-score");
const percentile = document.getElementById("percentile");
const priceScore = document.getElementById("price-score");


function showScreen(screen) {

    homeScreen.classList.remove("active");
    questionScreen.classList.remove("active");
    resultScreen.classList.remove("active");
    finalScreen.classList.remove("active");

    screen.classList.add("active");
}


function loadQuestion() {

    const q = questions[currentQuestion];

    questionNumber.textContent =
        `${currentQuestion + 1} / ${questions.length}`;

    category.textContent = q.category;
    question.textContent = q.question;

    answerInput.value = "";

    answerInput.focus();
}


function calculateScore(guess, actual) {

    const difference = Math.abs(guess - actual);

    const percentageError =
        difference / actual;

    let score = 100 - (percentageError * 100);

    score = Math.max(0, score);

    return Math.round(score);
}


function getScoreMessage(score) {

    if (score >= 95) {
        return "UNBELIEVABLY CLOSE 🔥";
    }

    if (score >= 85) {
        return "VERY CLOSE 👏";
    }

    if (score >= 70) {
        return "NOT BAD 👀";
    }

    if (score >= 50) {
        return "COULD BE WORSE 😅";
    }

    if (score >= 25) {
        return "YOUR INTUITION NEEDS WORK";
    }

    return "ABSOLUTELY NOWHERE NEAR 💀";
}


startButton.addEventListener("click", () => {

    currentQuestion = 0;
    totalScore = 0;

    showScreen(questionScreen);

    loadQuestion();
});


submitButton.addEventListener("click", () => {

    const guess = Number(answerInput.value);

    if (!guess || guess <= 0) {

        alert("Enter your guess first!");

        return;
    }

    currentGuess = guess;

    const q = questions[currentQuestion];

    const questionScore =
        calculateScore(guess, q.answer);

    totalScore += questionScore;

    actualAnswer.textContent =
        `£${q.answer.toFixed(2)}`;

    yourAnswer.textContent =
        `£${guess.toFixed(2)}`;

    score.textContent = questionScore;

    scoreMessage.textContent =
        getScoreMessage(questionScore);

    showScreen(resultScreen);
});


nextButton.addEventListener("click", () => {

    currentQuestion++;

    if (currentQuestion >= questions.length) {

        finishGame();

        return;
    }

    showScreen(questionScreen);

    loadQuestion();
});


function finishGame() {

    showScreen(finalScreen);

    finalScore.textContent = totalScore;

    const averageScore =
        totalScore / questions.length;

    const estimatedPercentile =
        Math.min(
            99,
            Math.max(
                1,
                Math.round(averageScore * 0.85)
            )
        );

    percentile.textContent =
        `${estimatedPercentile}%`;

    priceScore.textContent =
        Math.round(totalScore / questions.length);
}


playAgainButton.addEventListener("click", () => {

    currentQuestion = 0;
    totalScore = 0;

    showScreen(questionScreen);

    loadQuestion();
});


answerInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        submitButton.click();
    }

});