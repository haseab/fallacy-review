// chrome.storage.sync.remove(openAiApiKey, () => {
//   console.log(
//     `Key "${keyToRemove}" has been removed from chrome.storage.sync.`
//   );
// });

chrome.storage.sync.get("isEnabled", function (data) {
  console.log(data);
  if (data.isEnabled) {
    isEnabled = true;
    toggleButton.textContent = "Turn Off";
    toggleButton.style.color = "white";
    toggleButton.style.backgroundColor = "red";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleButton");
  isEnabled = true ? toggleButton.textContent === "Turn Off" : false;

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

        // Send a message to the content script using chrome.tabs.sendMessage
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
