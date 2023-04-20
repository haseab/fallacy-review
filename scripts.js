// @ts-check
const debugPrint = (debug, log) => {
  return debug ? console.log(log) : null;
};
const openAiRequest = async (mainMessageList, token) => {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        // model: "gpt-3.5-turbo",
        model: "gpt-3.5-turbo",
        messages: mainMessageList,
        temperature: 0,
        top_p: 1,
      }),
    });
    const data = await response.json();
    return data["choices"][0]["message"]["content"];
  } catch (error) {
    console.log(error);
  }
};

const tweetNumberToString = (rankOnePrompt) => {
  const rankOnePromptList = rankOnePrompt.split("\n").map((element) => {
    return element.split(":", 2);
  });
  const result = rankOnePromptList.map((subArray) => subArray[0]);
  return result.join(", ");
};
const deepFallacyCheck = async (
  rankOneTweets,
  mainMessageList,
  token,
  debug
) => {
  const rankOnePrompt = getRankOnePrompt(rankOneTweets, sensitivity);

  if (rankOnePrompt === "") {
    return;
  }
  const tweetNumberString = tweetNumberToString(rankOnePrompt);
  const instructions2 = `Output only ${tweetNumberString}in the following format:`;
  // const instructions3 = `Example: ${tweetNumber}: False Dilemma - Assumes that the only two options are either solving a problem by oneself or looking at the back of the book of life \\n`;

  let prompt = instructions2 + "\n" + rankOnePrompt + "\n";
  debugPrint(debug, "deepFallacyCheck - prompt:");
  debugPrint(debug, prompt);

  mainMessageList.push({ role: "user", content: prompt });

  const flaggedString = await openAiRequest(mainMessageList, token);
  mainMessageList.push({ role: "assistant", content: flaggedString });
  debugPrint(debug, "deepFallacyCheck - flaggedString:");
  debugPrint(debug, flaggedString);
  const flaggedList = flaggedString
    .split("\n")
    .filter((tweet) => {
      return tweet != "";
    })
    .map((explanation) => {
      return explanation.split(":", 2);
    });
  return flaggedList;
};

const stringToObject = (rankingsString, delimiter) => {
  // convert the tweetClassificationString to an object
  const rankingsObject = {};
  const rankingsArray = rankingsString.split(delimiter);
  rankingsArray.forEach((tweet) => {
    const tweetArray = tweet.split(":", 2);
    rankingsObject[tweetArray[0].trim()] = 100 - parseInt(tweetArray[1]);
  });
  return rankingsObject;
};

const quickFallacyCheck = async (tweetsObject, token, debug) => {
  const systemInstruction = `Your goal is to find logical fallacies in Tweets.
`;

  const newInstruction = `## SYSTEM:
  Using the knowledge of David Kelley from the book "The Art of Reasoning". You are an expert in logical fallacies and flawed reasoning.
  
  ## INSTRUCTIONS:
Grade each tweet on a scale of 0 to 100% (with increments of 5%) for flawed reasoning and NOT on factual accuracy. 
  
  ## OUTPUT
  The output SYNTAX should be EXACTLY the same as the "## EXAMPLE" below (include commas, don't include periods). 
  
  ## EXAMPLE
  Tweet X: X%, Tweet X: X%, Tweet X:  X%, Tweet X: X%, Tweet X: X%
    
  ## TWEETS (all text below):`;

  // const instructions1 = `Go through each of the tweets and follow the following instructions:
  // Assign the Tweet as Rank 1 if there is absolutely certain that the tweet has a statement which is a Logical Fallacy.
  // Assign the Tweet as Rank 2 if there is a statement in the tweet that is a suspected Fallacy, but unclear what the intention of the argument is.
  // Assign the Tweet as Rank 3 if there is a statement in the tweet that may be a Fallacy but needs more context.
  // Assign the Tweet as Rank 4 if it there is no sign of any Logical Fallacy in the tweet.

  // The output SYNTAX should be EXACTLY the same as the example below (include commas, don't include periods).

  // Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X

  // TWEETS (all text below):
  // `;

  let prompt = newInstruction + "\n" + JSON.stringify(tweetsObject);
  debugPrint(debug, "quickFallacyCheck - prompt:");
  debugPrint(debug, prompt);

  let mainMessageList = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt },
  ];
  // return data;

  const rankingsString = await openAiRequest(mainMessageList, token);
  console.log("quickFallacyCheck - rankingsString:");
  console.log(rankingsString);
  const rankingsObject = stringToObject(rankingsString, ",");
  return [rankingsObject, mainMessageList];
};

const highlightTextNodes = (node, flagged, explanation, debug) => {
  if (typeof explanation == "number" || typeof explanation == "string") {
    if (node.innerText.includes(flagged)) {
      // Create a unique Id given the flagged and explanation
      const uniqueId = `${getUniqueNumber(flagged)}`;

      const nodeList = node.textContent.split(flagged);
      const preDiv = node.cloneNode(true);
      preDiv.setAttribute("id", "pre-div" + uniqueId);
      const span = node.cloneNode(true);
      span.setAttribute("id", "span" + uniqueId);
      const postDiv = node.cloneNode(true);
      postDiv.setAttribute("id", "post-div" + uniqueId);
      preDiv.textContent = nodeList[0];
      postDiv.textContent = nodeList[1];

      span.textContent = flagged;
      span.style.color = "black";

      if (typeof explanation == "string") {
        console.log("Fallacy found! highlighting...");
        debugPrint(debug, uniqueId);
        const oldPreDiv = document.querySelector("#pre-div" + uniqueId);
        const oldSpan = document.querySelector("#span" + uniqueId);
        const oldTooltip = document.querySelector("#tooltip" + uniqueId);

        oldPreDiv.parentNode.style = "padding-top: 30px";
        oldSpan.style.backgroundColor = "yellow";
        oldTooltip.textContent = explanation;
        trackedTweets[uniqueId] = oldSpan;
      } else {
        console.log("Potential fallacy found! highlighting...");
        const tooltipContainer = document.createElement("div");
        tooltipContainer.className = "tooltip-container";
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.setAttribute("id", "tooltip" + uniqueId);
        tooltip.textContent = "Potential Fallacy! Explanation Loading...";
        node.parentNode.replaceChild(preDiv, node);
        preDiv.parentNode.appendChild(tooltipContainer);
        tooltipContainer.appendChild(span);
        tooltipContainer.appendChild(tooltip);
        preDiv.parentNode.appendChild(postDiv);
        span.style.backgroundColor = "yellow";
      }
    }
  }
};
const highlightLoop = (arrOfObjects, debug) => {
  arrOfObjects.forEach((flaggedObject) => {
    document.querySelectorAll('[data-testid="tweetText"]').forEach((node) => {
      highlightTextNodes(
        node,
        Object.keys(flaggedObject)[0], // returns the tweet for the flaggedObject.
        Object.values(flaggedObject)[0], // returns the explanation for the flaggedObject.
        debug
      );
    });
  });
};
const joinOnTweetName = (rankOneTweets, tweetsObject) => {
  console.log("Rank 1 Tweets:");
  console.log(rankOneTweets);
  return rankOneTweets.map(([tweet_key, score]) => {
    let dic = {};
    dic[tweetsObject[tweet_key]] = score;
    return dic;
  });
};

const initialHighlight = async (rankOneTweets, tweetsObject, debug) => {
  const arrOfObjects = joinOnTweetName(rankOneTweets, tweetsObject);
  debugPrint(debug, "initialHighlight - arrOfObjects:");
  debugPrint(debug, arrOfObjects);
  highlightLoop(arrOfObjects, debug);
};

function getRankOnePrompt(rankOneTweets, sensitivity) {
  let text = "";
  rankOneTweets
    .map(([tweet, rank]) => tweet)
    .forEach((tweet) => {
      // Ouput Tweet 1: <fallacy type and explanation>
      text += `${tweet}: <fallacy type and explanation>\n`;
    });
  return text;
}
const highlightSentences = async (tweetsObject, token, debug, sensitivity) => {
  const [rankingsObject, mainMessageList] = await quickFallacyCheck(
    tweetsObject,
    token,
    debug
  );
  debugPrint(debug, "highlightSentences - rankingsObject:");
  debugPrint(debug, rankingsObject);
  const rankOneTweets = Object.entries(rankingsObject).filter(
    ([tweet, score]) => score <= parseInt(sensitivity)
  );
  debugPrint(debug, "highlightSentences - rankOneTweets:");
  debugPrint(debug, rankOneTweets);
  const [tweetExplanationsDict, cpuResult] = await Promise.all([
    deepFallacyCheck(rankOneTweets, mainMessageList, token, debug),
    initialHighlight(rankOneTweets, tweetsObject, debug),
  ]);
  if (rankOneTweets.length == 0) {
    return;
  }
  const arrOfObjects = joinOnTweetName(tweetExplanationsDict, tweetsObject);
  debugPrint(debug, "highlightSentences - arrOfObjects:");
  debugPrint(debug, arrOfObjects);
  highlightLoop(arrOfObjects);
};

const getUniqueNumber = (text) => {
  return [...text].reduce((acc, char) => acc + char.charCodeAt(0), 0);
};

const waitForTweets = async () => {
  let tweets = [];
  while (tweets.length == 0) {
    // console.log("no more tweets found, trying again");
    // @ts-ignore
    tweets = Array.from(document.querySelectorAll('[data-testid="tweetText"]'));
    await new Promise((r) => setTimeout(r, 1000));
  }
  return tweets;
};

const getTweets = async () => {
  this.count = 0;
  let tweetsObject = {};
  let tweets = await waitForTweets();

  tweets.forEach((tweet) => {
    const tweetText = tweet.textContent;
    const uniqueId = `${getUniqueNumber(tweetText)}`;
    if (trackedTweets.hasOwnProperty(uniqueId) || tweetText.length == 0) {
      if (
        trackedTweets[uniqueId] !== undefined &&
        tweet.style.backgroundColor != "yellow"
      ) {
        const toolTipContainer = trackedTweets[uniqueId].parentNode;
        tweet.parentNode.replaceChild(toolTipContainer, tweet);
        toolTipContainer.parentNode.style.paddingTop = "30px";
      }
      return;
    }
    if (this.count >= 10) {
      return;
    }
    this.count += 1;
    trackedTweets[uniqueId] = undefined;
    tweetsObject[`Tweet ${this.count}`] = tweetText;
  });
  return tweetsObject;
};

const trackedTweets = {};
let isEnabled = false;
const debug = true;
let sensitivity = 30;

// chrome.storage.sync.clear(() => {
//   console.log("cleared");
// });

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("listening...");
  if (typeof request !== "object") {
    return;
  }
  if (request.isEnabled != undefined) {
    console.log("on/off button clicked...");
    isEnabled = request.isEnabled;
    chrome.storage.sync.get(["openAiApiKey", "sensitivity"], async (data) => {
      mainLoop(data.openAiApiKey, debug, parseInt(data.sensitivity));
    });
  } else if (request.sensitivity != undefined) {
    console.log(`sensitivity changed to ${request.sensitivity}`);
    sensitivity = parseInt(request.sensitivity);
  } else {
    console.log("Something went wrong...");
  }
});

const mainLoop = async (token, debug, localSensitivity) => {
  if (!isEnabled) {
    return;
  }
  sensitivity = localSensitivity;
  debugPrint(debug, "Checking for fallacies...");
  console.log("sensitivity: " + sensitivity);

  const tweetsObject = await getTweets();
  debugPrint(debug, "mainLoop - tweetsObject:");
  debugPrint(debug, tweetsObject);
  if (Object.keys(tweetsObject).length === 0) {
    await new Promise((r) => setTimeout(r, 50));
  } else {
    await highlightSentences(tweetsObject, token, debug, sensitivity);
  }

  // Set a delay before the next iteration and recursively call the mainLoop function
  setTimeout(mainLoop, 75, token, debug, sensitivity);
};

// Initialize by checking the extension state in local storage or sync storage
chrome.storage.sync.get(
  ["isEnabled", "openAiApiKey", "sensitivity"],
  async (data) => {
    // console.log(data);
    if (data.isEnabled) {
      isEnabled = true;
      mainLoop(data.openAiApiKey, debug, parseInt(data.sensitivity));
    }
  }
);
