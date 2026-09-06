// ==========================================
// GROWBLE GST CALCULATOR
// ==========================================

const amountEl = document.getElementById("amount");
const rateEl = document.getElementById("rate");

const addTab = document.getElementById("addTab");
const removeTab = document.getElementById("removeTab");

const intraBtn = document.getElementById("intraBtn");
const interBtn = document.getElementById("interBtn");

const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const resultTitle = document.getElementById("resultTitle");

const taxableEl = document.getElementById("taxable");
const rateResultEl = document.getElementById("rateResult");
const gstEl = document.getElementById("gst");

const cgstEl = document.getElementById("cgst");
const sgstEl = document.getElementById("sgst");
const igstEl = document.getElementById("igst");

const totalEl = document.getElementById("total");

const intraBreakdown =
  document.getElementById("intraBreakdown");

const interBreakdown =
  document.getElementById("interBreakdown");


// ==========================================
// STATE
// ==========================================

let mode = "add";

let transactionType = "intra";


// ==========================================
// FORMAT INR
// ==========================================

function formatCurrency(value) {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    minimumFractionDigits: 2,

    maximumFractionDigits: 2

  }).format(value || 0);

}


// ==========================================
// GET VALUES
// ==========================================

function getAmount() {

  const value =
    Number(amountEl.value);

  if (!Number.isFinite(value) || value < 0) {

    return 0;

  }

  return value;
}


function getRate() {

  const value =
    Number(rateEl.value);

  if (!Number.isFinite(value) || value < 0) {

    return 0;

  }

  return value;
}


// ==========================================
// CALCULATE
// ==========================================

function calculateGST() {

  const amount = getAmount();

  const rate = getRate();

  let taxableAmount = 0;

  let gstAmount = 0;

  let totalAmount = 0;


  // ----------------------------------------
  // ADD GST
  // ----------------------------------------

  if (mode === "add") {

    taxableAmount = amount;

    gstAmount =
      taxableAmount * rate / 100;

    totalAmount =
      taxableAmount + gstAmount;

  }


  // ----------------------------------------
  // REMOVE GST
  // ----------------------------------------

  else {

    totalAmount = amount;


    if (rate === 0) {

      taxableAmount = amount;

    }

    else {

      taxableAmount =
        amount / (1 + rate / 100);

    }


    gstAmount =
      totalAmount - taxableAmount;

  }


  // ----------------------------------------
  // GST COMPONENTS
  // ----------------------------------------

  const cgst =
    gstAmount / 2;

  const sgst =
    gstAmount / 2;

  const igst =
    gstAmount;


  // ----------------------------------------
  // UPDATE UI
  // ----------------------------------------

  taxableEl.textContent =
    formatCurrency(taxableAmount);

  rateResultEl.textContent =
    rate + "%";

  gstEl.textContent =
    formatCurrency(gstAmount);


  cgstEl.textContent =
    formatCurrency(cgst);

  sgstEl.textContent =
    formatCurrency(sgst);

  igstEl.textContent =
    formatCurrency(igst);


  totalEl.textContent =
    formatCurrency(totalAmount);


  // ----------------------------------------
  // TITLE
  // ----------------------------------------

  if (mode === "add") {

    resultTitle.textContent =
      "GST Added";

  }

  else {

    resultTitle.textContent =
      "GST Removed";

  }


  // ----------------------------------------
  // TRANSACTION DISPLAY
  // ----------------------------------------

  if (transactionType === "intra") {

    intraBreakdown.style.display =
      "block";

    interBreakdown.style.display =
      "none";

  }

  else {

    intraBreakdown.style.display =
      "none";

    interBreakdown.style.display =
      "block";

  }

}


// ==========================================
// SET ADD / REMOVE MODE
// ==========================================

function setMode(newMode) {

  mode = newMode;


  if (mode === "add") {

    addTab.classList.add("active");

    removeTab.classList.remove("active");

    amountEl.placeholder =
      "Enter amount before GST";

  }

  else {

    addTab.classList.remove("active");

    removeTab.classList.add("active");

    amountEl.placeholder =
      "Enter amount including GST";

  }


  calculateGST();

}


// ==========================================
// SET TRANSACTION TYPE
// ==========================================

function setTransactionType(type) {

  transactionType = type;


  if (transactionType === "intra") {

    intraBtn.classList.add("active");

    interBtn.classList.remove("active");

  }

  else {

    intraBtn.classList.remove("active");

    interBtn.classList.add("active");

  }


  calculateGST();

}


// ==========================================
// EVENT: ADD GST
// ==========================================

addTab.addEventListener(
  "click",
  function () {

    setMode("add");

  }
);


// ==========================================
// EVENT: REMOVE GST
// ==========================================

removeTab.addEventListener(
  "click",
  function () {

    setMode("remove");

  }
);


// ==========================================
// EVENT: INTRA STATE
// ==========================================

intraBtn.addEventListener(
  "click",
  function () {

    setTransactionType("intra");

  }
);


// ==========================================
// EVENT: INTER STATE
// ==========================================

interBtn.addEventListener(
  "click",
  function () {

    setTransactionType("inter");

  }
);


// ==========================================
// EVENT: AMOUNT
// ==========================================

amountEl.addEventListener(
  "input",
  calculateGST
);


// ==========================================
// EVENT: GST RATE
// ==========================================

rateEl.addEventListener(
  "change",
  calculateGST
);


// ==========================================
// CLEAR
// ==========================================

clearBtn.addEventListener(
  "click",
  function () {

    amountEl.value = "";

    rateEl.value = "18";

    setMode("add");

    setTransactionType("intra");

    amountEl.focus();

  }
);


// ==========================================
// COPY RESULT
// ==========================================

copyBtn.addEventListener(
  "click",
  async function () {

    const taxable =
      taxableEl.textContent;

    const gst =
      gstEl.textContent;

    const total =
      totalEl.textContent;


    let breakdown = "";


    if (transactionType === "intra") {

      breakdown =
`CGST: ${cgstEl.textContent}
SGST: ${sgstEl.textContent}`;

    }

    else {

      breakdown =
`IGST: ${igstEl.textContent}`;

    }


    const text =
`Growble GST Calculation

Mode: ${
  mode === "add"
    ? "Add GST"
    : "Remove GST"
}

GST Rate: ${rateEl.value}%

Taxable Amount: ${taxable}

GST Amount: ${gst}

${breakdown}

Total Amount: ${total}`;


    try {

      await navigator.clipboard.writeText(text);


      const originalText =
        copyBtn.textContent;


      copyBtn.textContent =
        "Copied ✓";


      setTimeout(
        function () {

          copyBtn.textContent =
            originalText;

        },
        1500
      );

    }

    catch (error) {

      alert(
        "Unable to copy the result."
      );

    }

  }
);


// ==========================================
// INITIAL STATE
// ==========================================

calculateGST();