exports.handler = async function () {
  const competitions = [
    {
      title: "OzBargain Competitions",
      reason: "Best for filtering Australia-wide, website-entry competitions.",
      url: "https://www.ozbargain.com.au/competition"
    },
    {
      title: "AussieComps - New Australian Competitions",
      reason: "Good daily Australian competition list.",
      url: "https://www.aussiecomps.com/"
    },
    {
      title: "Competitions.com.au",
      reason: "Verified Australian competitions, including free-entry options.",
      url: "https://www.competitions.com.au/"
    },
    {
      title: "Competitions Guide",
      reason: "Large Australian competitions directory.",
      url: "https://www.competitionsguide.com.au/"
    },
    {
      title: "Australian Made Competitions",
      reason: "Free Australian prize draws with simple entry.",
      url: "https://australianmade.com.au/competitions"
    }
  ];

  return {
    statusCode: 200,
    body: JSON.stringify({
      updated: new Date().toLocaleString("en-AU", {
        timeZone: "Australia/Perth"
      }),
      today: competitions,
      yesterday: competitions
    })
  };
};
