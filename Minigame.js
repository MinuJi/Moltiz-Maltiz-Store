let randomNumber;
let remainingChances = 0;
let gameStarted = false;

function startGame() {
  const selectedValue = Number(document.getElementById("chanceCount").value);
  if (!selectedValue) return;

  randomNumber = Math.floor(Math.random() * 100) + 1;
  remainingChances = selectedValue;
  gameStarted = true;

  document.getElementById("chanceDisplay").innerText = `remaining opportunity: ${remainingChances}times`;
  document.getElementById("result").innerText = "";
  document.getElementById("guess").value = "";
}

function checkGuess() {
  if (!gameStarted) {
    alert("Please choose your chance first!");
    return;
  }

  const guessInput = document.getElementById("guess").value;
  const guess = Number(guessInput);
  const result = document.getElementById("result");
  const gameImage = document.getElementById("gameImage");

  if (!guessInput || isNaN(guess) || guess < 1 || guess > 100) {
    const randomHint = Math.random() > 0.5 ? "🔼 UP" : "🔽 DOWN";
    result.innerHTML = `
      <div style="color: #e74c3c; font-weight: bold;">❗ ${randomHint} Please enter a number!</div>
    `;
    return;
  }

  if (guess === randomNumber) {
    result.innerHTML = "Correct! Amazing!";
    gameImage.src = "https://i.pinimg.com/736x/ed/38/4a/ed384ac1e2fe2e7fea1a3a6cecf5de95.jpg"; // ✅ 정답 이미지로 변경
    gameStarted = false;
  }  else {
  remainingChances--;

  // ❌ 오답 이미지 랜덤
  const wrongImages = [
    "https://i.pinimg.com/736x/46/01/e8/4601e817c4c4e1647f943fb093aa5601.jpg",
    "https://i.pinimg.com/736x/76/98/aa/7698aa19454bcc950243979cac92a92e.jpg", //배열
    "https://i.pinimg.com/736x/a7/75/39/a7753961da4f1342bafa7f69eb1b5d48.jpg"
  ];
  const randomIndex = Math.floor(Math.random() * wrongImages.length);
  gameImage.src = wrongImages[randomIndex];   //랜덤 확률

  // 🌀 흔들림 효과 추가
gameImage.classList.add("shake");

// 흔들림 효과 끝나면 제거 (한 번만 실행되게)
setTimeout(() => {
  gameImage.classList.remove("shake");
}, 400); // 애니메이션 길이와 맞춰야 함

    if (remainingChances <= 0) {
      result.innerHTML = `Too bad... The answer is It was ${randomNumber}. <br> Please try again!`;
      gameStarted = false;
    } else {
      const hint = guess < randomNumber ? "🔼 UP" : "🔽 DOWN";
      result.innerHTML = `${hint}<br> remaining opportunity: ${remainingChances}times`;
    }
  }

  document.getElementById("chanceDisplay").innerText = `remaining opportunity: ${remainingChances}times`;
}

function resetGame() {
  gameStarted = false;
  randomNumber = null;
  remainingChances = 0;

  document.getElementById("guess").value = "";
  document.getElementById("result").innerText = "";
  document.getElementById("chanceDisplay").innerText = "Please select the number";
  document.getElementById("chanceCount").value = "";

  document.getElementById("gameImage").src = "https://i.pinimg.com/736x/fa/6e/12/fa6e12d441772c4667224b10a05b1010.jpg";
  document.getElementById("startImage").src = "https://i.pinimg.com/736x/65/ac/72/65ac728a88c83d37c63d7e7da389671a.jpg";
}
