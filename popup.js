// chrome.storage.sync.remove(openAiApiKey, () => {
//   console.log(
//     `Key "${keyToRemove}" has been removed from chrome.storage.sync.`
//   );
// });

chrome.storage.sync.get(["isEnabled", "sensitivity"], function (data) {
  console.log(data);
  sensitivitySlider = document.getElementById("sensitivity-slider");
  sensitivity = parseInt(data.sensitivity);
  sensitivitySlider.value = sensitivity;
  if (data.isEnabled) {
    isEnabled = true;
    toggleButton.textContent = "Turn Off";
    toggleButton.style.color = "white";
    toggleButton.style.backgroundColor = "red";
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const costExplanationLink = document.getElementById("cost-explanation-link");
  const creditLink = document.getElementById("credit-card-link");
  const apiKeyLink = document.getElementById("api-key-link");
  costExplanationLink.addEventListener("click", () => {
    chrome.tabs.create({ url: costExplanationLink.href, active: false });
  });
  creditLink.addEventListener("click", () => {
    chrome.tabs.create({ url: creditLink.href, active: false });
  });
  apiKeyLink.addEventListener("click", () => {
    chrome.tabs.create({ url: apiKeyLink.href, active: false });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  let toggleButton = document.getElementById("toggleButton");
  let sensitivitySlider = document.getElementById("sensitivity-slider");
  isEnabled = true ? toggleButton.textContent === "Turn Off" : false;

  //add a listener to when the sensitivity slider is changed
  sensitivitySlider.addEventListener("change", (e) => {
    chrome.storage.sync.set({ sensitivity: e.target.value });
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { sensitivity: e.target.value });
    });
    console.log(`changed sensitivity to ${e.target.value}`);
  });

  toggleButton.addEventListener("click", function () {
    console.log("button clicked");
    // check local storage if they have an API key
    chrome.storage.sync.get("openAiApiKey", (data) => {
      if (!data.openAiApiKey) {
        alert("You need to enter your OpenAI API key first!");
        toggleButton.textContent = "Turn On";
        toggleButton.style.color = "white";
        toggleButton.style.backgroundColor = "green";
        return;
      } else if (!data.openAiApiKey.includes("sk-")) {
        alert("This is not a valid OpenAI API key!");
        isEnabled = false;
        toggleButton.textContent = "Turn On";
        toggleButton.style.color = "white";
        toggleButton.style.backgroundColor = "green";
        return;
      } else {
        isEnabled = !isEnabled;
        if (isEnabled) {
          toggleButton.textContent = "Turn Off";
          toggleButton.style.color = "white";
          toggleButton.style.backgroundColor = "red";
        } else {
          toggleButton.textContent = "Turn On";
          toggleButton.style.color = "white";
          toggleButton.style.backgroundColor = "green";
        }

        // Save the extension state to local storage or sync storage
        chrome.storage.sync.set({ isEnabled: isEnabled });
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { isEnabled: isEnabled });
          }
        );
      }
    });
    toggleButton.textContent = "Turn Off";
    toggleButton.style.color = "white";
    toggleButton.style.backgroundColor = "red";
  });
});

document.getElementById("submit-button").addEventListener("click", () => {
  let inputData = document.getElementById("input-data").value;
  chrome.storage.sync.set({ openAiApiKey: inputData }, () => {
    console.log("API KEY locally saved");
    const inputBox = document.getElementById("input-data");
    const questions = document.getElementById("questions");
    // inputBox.style.display = "none";
    const thanksMessage = document.createElement("p");
    thanksMessage.style.color = "green";
    thanksMessage.textContent = "API KEY submitted!";
    inputBox.parentNode.insertBefore(thanksMessage, questions);
  });
});
