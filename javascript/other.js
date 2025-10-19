let hasScanned = false;

function startScan() {
  const qrScanner = new Html5Qrcode("reader");
  qrScanner.start(
    { facingMode: "environment" },
    {
      fps: 5,
      qrbox: 300
    },
    (decodedText) => {
      try {
        if(hasScanned) return;
        hasScanned = true;

        const url = newURL(decodedText);
        if(url.pathname.includes("result.html")) {
          location.href = decodedText;
        } else {
          alert("無効なQRコードです");
        }
      } catch {
        alert("読み取れませんでした");
      }

      setTimeout(() => {
        qrScanner.stop();
      }, 1000);
    },
    /*(errorMessage)  => {
      alert(errorMessage);
    }*/
  );
}

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const resultText = document.getElementById("resultText");

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.play();
    requestAnimationFrame(scanLoop);
  });

function scanLoop() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      resultText.textContent = "読み取った内容：" + code.data;
      // 語りを復元するなら location.href = code.data;
      return; // 読み取り成功で停止
    }
  }
  requestAnimationFrame(scanLoop);
}

$(function() {
    $('.hamburger').click(function() {
        $('.menu').toggleClass('open');

        $(this).toggleClass('active');
    });
});