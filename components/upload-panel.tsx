"use client";

import React, { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";

export interface CompanyOption {
  companyId: string;
  displayName: string;
}

export interface UploadPanelProps {
  children?: React.ReactNode;
  companyId?: string;
  companies?: CompanyOption[];
  defaultCompanyId?: string;
}

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

export function UploadPanel({
  children,
  companyId: propCompanyId,
  companies,
  defaultCompanyId,
}: UploadPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active tab: text, document, image
  const [activeTab, setActiveTab] = useState<"text" | "document" | "image">("text");

  // Determine companyId
  const urlCompanyId = searchParams.get("companyId");
  const fallbackCompanyId =
    propCompanyId ||
    defaultCompanyId ||
    urlCompanyId ||
    (companies && companies.length > 0 ? companies[0].companyId : "");

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(fallbackCompanyId);

  // Update selectedCompanyId if prop changes
  const effectiveCompanyId = propCompanyId || selectedCompanyId;

  // Document tab state
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docProgress, setDocProgress] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Image tab state
  const [imgTitle, setImgTitle] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [imgProgress, setImgProgress] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const imgFileInputRef = useRef<HTMLInputElement>(null);

  // ── Document validation and submission ──
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setDocFile(null);
      return;
    }

    // Browser-side size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setDocError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Files up to 4 MB are accepted.`,
      );
      setDocFile(null);
      if (docFileInputRef.current) docFileInputRef.current.value = "";
      return;
    }

    // Browser-side type check
    const ext = file.name.toLowerCase().split(".").pop();
    const mime = file.type.toLowerCase();
    const isDoc =
      ext === "pdf" ||
      ext === "docx" ||
      mime === "application/pdf" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isDoc) {
      setDocError("Invalid document type. Only PDF (.pdf) and Word (.docx) files are accepted.");
      setDocFile(null);
      if (docFileInputRef.current) docFileInputRef.current.value = "";
      return;
    }

    setDocFile(file);
    // If title is empty, pre-fill with file name without extension
    if (!docTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(baseName);
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocError(null);

    if (!effectiveCompanyId) {
      setDocError("Please select a company workspace first.");
      return;
    }

    if (!docTitle.trim()) {
      setDocError("Please enter a title for the document.");
      return;
    }

    if (!docFile) {
      setDocError("Please select a document file (.pdf or .docx).");
      return;
    }

    if (docFile.size > MAX_FILE_SIZE_BYTES) {
      setDocError("The file exceeds the 4 MB limit. Please select a smaller file.");
      return;
    }

    setIsUploadingDoc(true);
    setDocProgress("Uploading and extracting document...");

    try {
      const formData = new FormData();
      formData.append("companyId", effectiveCompanyId);
      formData.append("title", docTitle.trim());
      formData.append("file", docFile);

      setDocProgress("Running brand and accessibility checks...");

      const res = await fetch("/api/uploads/document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setDocError(data.error || "Failed to check document. Please try again.");
        setIsUploadingDoc(false);
        setDocProgress(null);
        return;
      }

      setDocProgress("Checking complete! Loading submission review...");
      router.push(`/submit/${data.submissionId}`);
    } catch (err: any) {
      console.error("Document upload failed:", err);
      setDocError(err.message || "An unexpected error occurred while checking the document.");
      setIsUploadingDoc(false);
      setDocProgress(null);
    }
  };

  // ── Image validation and submission ──
  const handleImgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImgError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setImgFile(null);
      return;
    }

    // Browser-side size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImgError(
        `Image is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Files up to 4 MB are accepted.`,
      );
      setImgFile(null);
      if (imgFileInputRef.current) imgFileInputRef.current.value = "";
      return;
    }

    // Browser-side type check
    const ext = file.name.toLowerCase().split(".").pop();
    const mime = file.type.toLowerCase();
    const isImage =
      ["png", "jpg", "jpeg", "webp"].includes(ext || "") ||
      ["image/png", "image/jpeg", "image/webp"].includes(mime);

    if (!isImage) {
      setImgError("Invalid image type. Only PNG, JPG, and WebP files are accepted.");
      setImgFile(null);
      if (imgFileInputRef.current) imgFileInputRef.current.value = "";
      return;
    }

    setImgFile(file);
    // If title is empty, pre-fill with file name without extension
    if (!imgTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setImgTitle(baseName);
    }
  };

  const handleImgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImgError(null);

    if (!effectiveCompanyId) {
      setImgError("Please select a company workspace first.");
      return;
    }

    if (!imgTitle.trim()) {
      setImgError("Please enter a title for the image.");
      return;
    }

    if (!imgFile) {
      setImgError("Please select an image file (PNG, JPG, or WebP).");
      return;
    }

    if (!altText.trim()) {
      setImgError("Alt text is required. Describe the image for someone who cannot see it.");
      return;
    }

    if (imgFile.size > MAX_FILE_SIZE_BYTES) {
      setImgError("The image exceeds the 4 MB limit. Please select a smaller image.");
      return;
    }

    setIsUploadingImg(true);
    setImgProgress("Uploading and analysing image colors...");

    try {
      const formData = new FormData();
      formData.append("companyId", effectiveCompanyId);
      formData.append("title", imgTitle.trim());
      formData.append("altText", altText.trim());
      formData.append("file", imgFile);

      setImgProgress("Running brand color, alt text, and tone checks...");

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setImgError(data.error || "Failed to check image. Please try again.");
        setIsUploadingImg(false);
        setImgProgress(null);
        return;
      }

      setImgProgress("Checking complete! Loading submission review...");
      router.push(`/submit/${data.submissionId}`);
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setImgError(err.message || "An unexpected error occurred while checking the image.");
      setIsUploadingImg(false);
      setImgProgress(null);
    }
  };

  // Image button stays disabled until a file and alt text are chosen
  const isImageCheckDisabled =
    isUploadingImg || !imgFile || !altText.trim();

  return (
    <div className="w-full space-y-6">
      {/* Three tabs: Text, Document (PDF or Word), Image */}
      <div className="border-b border-border pb-px">
        <div
          role="tablist"
          aria-label="Submission format"
          className="flex gap-2 sm:gap-4 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "text"}
            onClick={() => setActiveTab("text")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "text"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            }`}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Text
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "document"}
            onClick={() => setActiveTab("document")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "document"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            }`}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Document (PDF or Word)
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "image"}
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "image"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            }`}
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Image
          </button>
        </div>
      </div>

      {/* Optional workspace selector if multiple companies provided and no fixed companyId */}
      {companies && companies.length > 1 && !propCompanyId && activeTab !== "text" && (
        <div>
          <Label
            htmlFor="upload-company-select"
            className="block text-sm font-medium mb-1.5"
          >
            Company Workspace <span className="text-destructive">*</span>
          </Label>
          <select
            id="upload-company-select"
            value={effectiveCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            disabled={isUploadingDoc || isUploadingImg}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tab 1: Text tab renders children */}
      {activeTab === "text" && <div>{children}</div>}

      {/* Tab 2: Document tab */}
      {activeTab === "document" && (
        <form onSubmit={handleDocSubmit} className="space-y-6">
          {docError && (
            <div
              role="alert"
              className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{docError}</span>
            </div>
          )}

          {docProgress && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{docProgress}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Q3 Brand Campaign Overview"
              disabled={isUploadingDoc}
              required
            />
          </div>

          {/* File Picker (.pdf and .docx) */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-file" className="text-sm font-medium">
              Document file (.pdf, .docx) <span className="text-destructive">*</span>
            </Label>
            <input
              ref={docFileInputRef}
              id="doc-file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleDocFileChange}
              disabled={isUploadingDoc}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md p-1.5 bg-background shadow-sm"
              required
            />
            {docFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: <span className="font-medium text-foreground">{docFile.name}</span> ({(docFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Note: files up to 4 MB are accepted and only the first 10,000 characters are checked */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/60 border border-border text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
            <span>
              Files up to 4 MB are accepted and only the first 10,000 characters are checked.
            </span>
          </div>

          {/* Submit button: Check document */}
          <Button
            type="submit"
            disabled={isUploadingDoc || !docFile}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {isUploadingDoc && <Loader2 className="h-4 w-4 animate-spin" />}
            {isUploadingDoc ? "Checking document..." : "Check document"}
          </Button>
        </form>
      )}

      {/* Tab 3: Image tab */}
      {activeTab === "image" && (
        <form onSubmit={handleImgSubmit} className="space-y-6">
          {imgError && (
            <div
              role="alert"
              className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{imgError}</span>
            </div>
          )}

          {imgProgress && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{imgProgress}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="img-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="img-title"
              value={imgTitle}
              onChange={(e) => setImgTitle(e.target.value)}
              placeholder="e.g. Social Announcement Graphic"
              disabled={isUploadingImg}
              required
            />
          </div>

          {/* File Picker (PNG, JPG, WebP) */}
          <div className="space-y-1.5">
            <Label htmlFor="img-file" className="text-sm font-medium">
              Image file (PNG, JPG, WebP) <span className="text-destructive">*</span>
            </Label>
            <input
              ref={imgFileInputRef}
              id="img-file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={handleImgFileChange}
              disabled={isUploadingImg}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-input rounded-md p-1.5 bg-background shadow-sm"
              required
            />
            {imgFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: <span className="font-medium text-foreground">{imgFile.name}</span> ({(imgFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Required alt text field */}
          <div className="space-y-1.5">
            <Label htmlFor="img-alt" className="text-sm font-medium">
              Alt text <span className="text-destructive">*</span>
            </Label>
            <Input
              id="img-alt"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="e.g. Close up of our product packaging against a solid blue background"
              disabled={isUploadingImg}
              required
              aria-describedby="img-alt-help"
            />
            {/* Help text */}
            <p id="img-alt-help" className="text-xs text-muted-foreground">
              Describe the image for someone who cannot see it
            </p>
          </div>

          {/* Submit button: Check image (disabled until file AND alt text are chosen) */}
          <Button
            type="submit"
            disabled={isImageCheckDisabled}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {isUploadingImg && <Loader2 className="h-4 w-4 animate-spin" />}
            {isUploadingImg ? "Checking image..." : "Check image"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default UploadPanel;
