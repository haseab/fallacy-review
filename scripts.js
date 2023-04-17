// @ts-check
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

const tweetNumberToString = (rank1Prompt) => {
  const rank1PromptList = rank1Prompt.split("\n").map((element) => {
    return element.split(":", 2);
  });
  const result = rank1PromptList.map((subArray) => subArray[0]);
  return result.join(", ");
};
const deepFallacyCheck = async (rank1Prompt, mainMessageList, token, debug) => {
  if (rank1Prompt === "") {
    return;
  }
  const tweetNumberString = tweetNumberToString(rank1Prompt);
  const instructions2 = `Output only ${tweetNumberString}in the following format:`;
  // const instructions3 = `Example: ${tweetNumber}: False Dilemma - Assumes that the only two options are either solving a problem by oneself or looking at the back of the book of life \\n`;

  let prompt = instructions2 + "\n" + rank1Prompt + "\n";
  debug ? console.log(prompt) : null;

  mainMessageList.push({ role: "user", content: prompt });

  const flaggedString = await openAiRequest(mainMessageList, token);
  mainMessageList.push({ role: "assistant", content: flaggedString });
  debug ? console.log(flaggedString) : null;
  const flaggedList = flaggedString
    .split("\n")
    .filter((tweet) => {
      return tweet != "";
    })
    .map((explanation) => {
      return explanation.split(":", 2);
    });
  const flaggedObject = Object.fromEntries(flaggedList);

  debug ? console.log(flaggedObject) : null;
  return flaggedObject;
};

const stringToObject = (rankingsString, delimiter) => {
  // convert the tweetClassificationString to an object
  const rankingsObject = {};
  const rankingsArray = rankingsString.split(delimiter);
  rankingsArray.forEach((tweet) => {
    const tweetArray = tweet.split(":");
    rankingsObject[tweetArray[0].trim()] = tweetArray[1].trim();
  });
  return rankingsObject;
};

const quickFallacyCheck = async (tweetsObject, token, debug) => {
  const systemInstruction = `Your goal is to find logical fallacies in Tweets.
`;
  const instructions1 = `Go through each of the tweets and follow the following instructions:
  Assign the Tweet as Rank 1 if there is absolutely certain that the tweet has a statement which is a Logical Fallacy. 
  Assign the Tweet as Rank 2 if there is a statement in the tweet that is a suspected Fallacy, but unclear what the intention of the argument is.
  Assign the Tweet as Rank 3 if there is a statement in the tweet that may be a Fallacy but needs more context.
  Assign the Tweet as Rank 4 if it there is no sign of any Logical Fallacy in the tweet.
  
  The output SYNTAX should be EXACTLY the same as the example below (include commas, don't include periods). 
  
  Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X, Tweet X: Rank X
  
  TWEETS (all text below):
  `;

  let prompt = instructions1 + "\n" + JSON.stringify(tweetsObject);
  debug ? console.log(prompt) : null;

  let mainMessageList = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt },
  ];
  // return data;

  const rankingsString = await openAiRequest(mainMessageList, token);
  const rankingsDict = stringToObject(rankingsString, ",");
  return [rankingsDict, mainMessageList];
};

const highlightTextNodes = (node, flagged, explanation, debug) => {
  const mapDict = {
    "Rank 1": "Absolutely a Fallacy. Explanation Loading...",
    "Rank 2": "Suspected Fallacy, but unclear argument. Loading...",
    "Rank 3": "Maybe a Fallacy but need more context. Loading...",
    "Rank 4": "No sign of Fallacy",
  };

  if (explanation.includes("Rank 1") || explanation[0].length > 10) {
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

      if (explanation[0].length > 10) {
        console.log("Fallacy found! highlighting...");
        debug ? console.log(uniqueId) : null;
        const oldPreDiv = document.querySelector("#pre-div" + uniqueId);
        const oldSpan = document.querySelector("#span" + uniqueId);
        const oldTooltip = document.querySelector("#tooltip" + uniqueId);

        oldPreDiv.parentNode.style = "padding-top: 30px";
        oldSpan.style.backgroundColor = "yellow";
        oldTooltip.textContent = explanation;
        trackedTweets[uniqueId] = oldSpan;
      } else {
        const tooltipContainer = document.createElement("div");
        tooltipContainer.className = "tooltip-container";
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.setAttribute("id", "tooltip" + uniqueId);
        tooltip.textContent = mapDict[explanation];
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
const highlightLoop = (flaggedObject, debug) => {
  flaggedObject.forEach((flagged) => {
    document.querySelectorAll('[data-testid="tweetText"]').forEach((node) => {
      highlightTextNodes(
        node,
        Object.keys(flagged)[0],
        Object.values(flagged),
        debug
      );
    });
  });
};
const joinOnTweetName = (rankingsDict, tweetsObject) => {
  return Object.entries(rankingsDict).map(([tweet_key, rank]) => {
    let dic = {};
    dic[tweetsObject[tweet_key]] = rank;
    return dic;
  });
};
const initialHighlight = async (rankingsDict, tweetsObject, debug) => {
  const flaggedObject = joinOnTweetName(rankingsDict, tweetsObject);
  highlightLoop(flaggedObject, debug);
};

function getRank1Prompt(rankingsDict) {
  const rankOneTweets = Object.entries(rankingsDict)
    .filter(([tweet, rank]) => rank === "Rank 1")
    .map(([tweet, rank]) => tweet);
  let text = "";
  rankOneTweets.forEach((tweet) => {
    // Ouput Tweet 1: <fallacy type and explanation>
    text += `${tweet}: <fallacy type and explanation>\n`;
  });
  return text;
}
const highlightSentences = async (tweetsObject, token, debug) => {
  const [rankingsDict, mainMessageList] = await quickFallacyCheck(
    tweetsObject,
    token,
    debug
  );
  debug ? console.log(rankingsDict) : null;
  const rank1Prompt = getRank1Prompt(rankingsDict);
  const [tweetExplanationsDict, cpuResult] = await Promise.all([
    deepFallacyCheck(rank1Prompt, mainMessageList, token, debug),
    initialHighlight(rankingsDict, tweetsObject, debug),
  ]);
  if (rank1Prompt === "") {
    return;
  }
  const flaggedObject = joinOnTweetName(tweetExplanationsDict, tweetsObject);
  debug ? console.log(flaggedObject) : null;
  highlightLoop(flaggedObject);
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

// chrome.storage.sync.clear(() => {
//   console.log("cleared");
// });

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("listening...");
  if (typeof request !== "object" || !("isEnabled" in request)) {
    return;
  }

  isEnabled = request.isEnabled;
  if (isEnabled) {
    chrome.storage.sync.get(["openAiApiKey"], async (data) => {
      mainLoop(data.openAiApiKey);
    });
  } else {
    console.log("Extension stopped...");
  }
});

const mainLoop = async (token, debug) => {
  debug ? console.log("Checking...") : null;
  if (!isEnabled) {
    return;
  }

  const tweetsObject = await getTweets();
  debug ? console.log(tweetsObject) : null;
  if (Object.keys(tweetsObject).length === 0) {
    await new Promise((r) => setTimeout(r, 50));
  } else {
    await highlightSentences(tweetsObject, token, debug);
  }

  // Set a delay before the next iteration and recursively call the mainLoop function
  setTimeout(mainLoop, 75, token, debug);
};

// Initialize by checking the extension state in local storage or sync storage
chrome.storage.sync.get(["isEnabled", "openAiApiKey"], async (data) => {
  const debug = true;
  if (data.isEnabled) {
    isEnabled = true;
    mainLoop(data.openAiApiKey, debug);
  }
});
