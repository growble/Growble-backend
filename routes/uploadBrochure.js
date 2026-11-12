const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const auth = require("../middleware/authMiddleware");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const { getPlanLimits } = require("../utils/planEntitlements");
const { getWorkspaceOwnerId } = require("../utils/workspace");

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 100000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, callback) => {
    if (
      file.mimetype !== "application/pdf" ||
      !file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      return callback(new Error("Upload a PDF document."));
    }
    callback(null, true);
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const workspaceOwnerId = getWorkspaceOwnerId(req.user);
    const [documents, count] = await Promise.all([
      KnowledgeDocument.find({ workspaceOwner: workspaceOwnerId })
        .select("name createdAt")
        .sort({ createdAt: -1 }),
      KnowledgeDocument.countDocuments({ workspaceOwner: workspaceOwnerId })
    ]);
    const limit = getPlanLimits(req.workspaceOwner.plan).knowledgeDocuments;

    res.json({
      documents,
      used: count,
      limit: Number.isFinite(limit) ? limit : null
    });
  } catch (error) {
    console.error("List knowledge documents error:", error);
    res.status(500).json({ message: "Could not load knowledge documents." });
  }
});

router.post("/", auth, (req, res, next) => {
  upload.single("pdf")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "PDF files must be 10 MB or smaller." });
    }
    return res.status(400).json({ message: error.message || "Invalid PDF upload." });
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Choose a PDF document to upload." });
  }

  const limit = getPlanLimits(req.workspaceOwner.plan).knowledgeDocuments;
  if (limit === 0) {
    return res.status(403).json({
      message: "Knowledge-base documents are available on paid plans."
    });
  }

  try {
    const workspaceOwnerId = getWorkspaceOwnerId(req.user);
    const documentCount = await KnowledgeDocument.countDocuments({
      workspaceOwner: workspaceOwnerId
    });
    if (documentCount >= limit) {
      return res.status(403).json({
        message: `Your ${req.workspaceOwner.plan} plan allows ${limit} knowledge-base document(s).`
      });
    }

    const parsed = await pdfParse(req.file.buffer);
    const text = parsed.text.trim();
    if (!text) {
      return res.status(400).json({ message: "The PDF does not contain extractable text." });
    }
    if (text.length > MAX_EXTRACTED_TEXT_LENGTH) {
      return res.status(413).json({
        message: "This PDF contains too much text. Split it into smaller documents and try again."
      });
    }

    const name = req.file.originalname
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "_")
      .slice(0, 180);
    const document = await KnowledgeDocument.create({
      workspaceOwner: workspaceOwnerId,
      uploadedBy: req.user._id,
      name,
      text
    });

    res.status(201).json({
      success: true,
      document: {
        _id: document._id,
        name: document.name,
        createdAt: document.createdAt
      },
      used: documentCount + 1,
      limit: Number.isFinite(limit) ? limit : null
    });
  } catch (error) {
    console.error("Upload knowledge document error:", error);
    res.status(500).json({ message: "Could not process this PDF document." });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const document = await KnowledgeDocument.findOneAndDelete({
      _id: req.params.id,
      workspaceOwner: getWorkspaceOwnerId(req.user)
    });
    if (!document) {
      return res.status(404).json({ message: "Knowledge document not found." });
    }
    res.json({ message: "Knowledge document removed." });
  } catch (error) {
    console.error("Delete knowledge document error:", error);
    res.status(500).json({ message: "Could not remove this document." });
  }
});

module.exports = router;
