const ethers = require("ethers");
const managerAbi = require("./abi/manager.json");
const lootboxAbi = require("./abi/lootbox.json");

const MANAGER = "0x491fdf136925858C269A920fbFCbbDd71f717408";
const RPC = "https://api.roninchain.com/rpc";
const startBlock = 42641559;
const endBlockOption = "latest"; // Set your desired endBlock, or use "latest"
const batchSize = 500; // The maximum allowed block range per query

const fileData = {
  startBlock: 42641559,
};

(async () => {
  try {
    // read data.json
    const fs = require("fs");
    // overrite data.json to make it empty
    fs.writeFileSync("data.json", "");

    const provider = ethers.getDefaultProvider(RPC);
    const manager = new ethers.Contract(MANAGER, managerAbi, provider);

    let latestBlock = await provider.getBlockNumber();
    let endBlock = endBlockOption === "latest" ? latestBlock : endBlockOption;
    console.log(`Scanning blocks from ${startBlock} to ${endBlock}...`);
    fileData.endBlock = endBlock;

    if (endBlock < startBlock) {
      console.error(
        "Error: endBlock must be greater than or equal to startBlock.",
      );
      return;
    }

    let totalLootboxCreatedEvents = 0;
    let allLootboxAddresses = [];
    let currentBlock = startBlock;

    while (currentBlock <= endBlock) {
      let toBlock = Math.min(currentBlock + batchSize - 1, endBlock);
      console.log(
        `Fetching LootboxCreated events from block ${currentBlock} to ${toBlock}...`,
      );

      try {
        const eventFilter = manager.filters.LootboxCreated();
        const events = await manager.queryFilter(
          eventFilter,
          currentBlock,
          toBlock,
        );

        for (const event of events) {
          if (event.args) {
            const lootboxAddress = event.args[0];
            allLootboxAddresses.push(lootboxAddress);
          }
        }
        totalLootboxCreatedEvents += events.length;
      } catch (error) {
        console.error(
          `Error fetching LootboxCreated events from ${currentBlock} to ${toBlock}:`,
          error,
        );
      }

      currentBlock = toBlock + 1;
    }

    fileData.totalLootboxes = totalLootboxCreatedEvents;

    let lb_to_nos_opened = {}; // lootbox to number of opens

    // Fetch LootBoxOpened events for each Lootbox
    let totalLootboxOpenedEvents = 0;

    let lb_to_nos_claimed = {}; // lootbox to number of claimed

    let totalLootboxClaimedEvents = 0;

    for (let i = 0; i < allLootboxAddresses.length; i++) {
      const lootboxAddress = allLootboxAddresses[i];
      lb_to_nos_opened[lootboxAddress] = 0;
      lb_to_nos_claimed[lootboxAddress] = 0;
      const lootbox = new ethers.Contract(lootboxAddress, lootboxAbi, provider);
      currentBlock = startBlock;

      while (currentBlock <= endBlock) {
        let toBlock = Math.min(currentBlock + batchSize - 1, endBlock);
        console.log(
          `Fetching LootBoxOpened and LootBoxClaimed events from block ${currentBlock} to ${toBlock} for lootbox: ${lootboxAddress}`,
        );

        try {
          const eventFilterOpen = lootbox.filters.LootBoxOpened();
          const events = await lootbox.queryFilter(
            eventFilterOpen,
            currentBlock,
            toBlock,
          );
          totalLootboxOpenedEvents += events.length;
          lb_to_nos_opened[lootboxAddress] += events.length;

          const eventFilterClaim = lootbox.filters.LootBoxClaimed();
          const eventsClaimed = await lootbox.queryFilter(
            eventFilterClaim,
            currentBlock,
            toBlock,
          );
          totalLootboxClaimedEvents += eventsClaimed.length;
          lb_to_nos_claimed[lootboxAddress] += eventsClaimed.length;
        } catch (error) {
          console.error(
            `Error fetching LootBoxOpened and LootBoxClaimed events from ${currentBlock} to ${toBlock} for ${lootboxAddress}:`,
            error,
          );
        }

        currentBlock = toBlock + 1;
      }
    }

    fileData.totalLootboxOpens = totalLootboxOpenedEvents;
    fileData.totalLootboxClaims = totalLootboxClaimedEvents;
    fileData.lb_to_nos_opened = lb_to_nos_opened;
    fileData.lb_to_nos_claimed = lb_to_nos_claimed;

    console.log(
      "-------------------------------RESULTS---------------------------------------------------------",
    );

    console.log("Total Lootbox Created: ", totalLootboxCreatedEvents);

    console.log(`All Lootbox Addresses: ${allLootboxAddresses}`);

    console.log(
      `Total times all Lootboxes were opened: ${totalLootboxOpenedEvents}`,
    );

    console.log(
      `Total times all Lootboxes were claimed: ${totalLootboxClaimedEvents}`,
    );

    for (let key in lb_to_nos_opened) {
      console.log(
        `Lootbox: ${key} was opened ${lb_to_nos_opened[key]} times and claimed ${lb_to_nos_claimed[key]} times`,
      );
    }

    console.log(
      "Total transactions(open/claim) on all lootboxes: ",
      totalLootboxOpenedEvents + totalLootboxClaimedEvents,
    );

    console.log(
      "-----------------------------------------------------------------------------------------------",
    );

    // store the data in a file
    fs.writeFileSync("data.json", JSON.stringify(fileData, null, 2));

    console.log("File written successfully");
  } catch (error) {
    console.error("Error initializing:", error);
  }
})();
