"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2 } from "lucide-react";

import type { Questions } from "@/types/bank-questions/questions";
import type { CategoryQuestion } from "@/types/bank-questions/category-questions";
import { Combobox } from "@/components/ui/combo-box";

import {
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  type CreateQuestionPayload,
  type QuestionType,
  type MCOption,
  type CategorizedOption,
} from "@/services/bank-questions/questions.service";
import {
  useServiceUploadMutation,
  buildServiceUploadFormData,
} from "@/services/bank-questions/service-upload.service";

// SunEditor (client only)
const SunEditor = dynamic(() => import("suneditor-react"), { ssr: false });

const extractUrlFromResponse = (res: unknown): string => {
  // 1. PERBAIKAN: Cek jika 'res' itu sendiri adalah string URL
  if (
    typeof res === "string" &&
    (res.startsWith("http") || res.startsWith("/"))
  ) {
    return res;
  }

  // 2. Lanjutkan logika lama jika 'res' adalah objek
  if (typeof res !== "object" || res === null) return "";
  const obj = res as Record<string, unknown>;

  // { data: "https://..." }  <-- punyamu
  if (typeof obj.data === "string") return obj.data;

  // { url: "..." }
  if (typeof obj.url === "string") return obj.url;

  // { file_url: "..." }
  if (typeof obj.file_url === "string") return obj.file_url;

  // { location: "..." }
  if (typeof obj.location === "string") return obj.location;

  // { data: { url/file_url/location } }
  if (typeof obj.data === "object" && obj.data !== null) {
    const dataObj = obj.data as Record<string, unknown>;
    if (typeof dataObj.url === "string") return dataObj.url;
    if (typeof dataObj.file_url === "string") return dataObj.file_url;
    if (typeof dataObj.location === "string") return dataObj.location;
  }

  return "";
};

type Props = {
  categories: CategoryQuestion[];
  initial?: Questions | null;
  defaultCategoryId: number | null;
  onSaved?: (saved: Questions) => void;
  submittingText?: string;
};

const DEFAULT_OPTIONS_MC: MCOption[] = [
  { option: "a", text: "", point: 0 },
  { option: "b", text: "", point: 0 },
  { option: "c", text: "", point: 0 },
  { option: "d", text: "", point: 0 },
  { option: "e", text: "", point: 0 },
];

const DEFAULT_OPTIONS_TF: MCOption[] = [
  { option: "a", text: "True", point: 1 },
  { option: "b", text: "False", point: 0 },
];

const DEFAULT_OPTIONS_MULTI: MCOption[] = [
  { option: "a", text: "", point: 0 },
  { option: "b", text: "", point: 0 },
  { option: "c", text: "", point: 0 },
];

const DEFAULT_OPTIONS_CATEGORIZED: CategorizedOption[] = [
  {
    text: "",
    point: 1,
    accurate_label: "",
    not_accurate_label: "",
    accurate: false,
    not_accurate: false,
  },
];

const cloneMC = (list: MCOption[]): MCOption[] => list.map((o) => ({ ...o }));
const cloneCat = (list: CategorizedOption[]): CategorizedOption[] =>
  list.map((o) => ({ ...o }));

export default function QuestionsForm({
  categories,
  initial,
  defaultCategoryId,
  onSaved,
  submittingText = "Simpan",
}: Props) {
  const isEdit = !!initial;

  // ===== Form state =====
  const [question_category_id, setCategoryId] = useState<number | null>(
    defaultCategoryId ?? null
  );
  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [question, setQuestion] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [totalPoint, setTotalPoint] = useState<number>(5);

  // options
  const [optionsMC, setOptionsMC] = useState<MCOption[]>([
    { option: "a", text: "", point: 0 },
    { option: "b", text: "", point: 0 },
    { option: "c", text: "", point: 0 },
    { option: "d", text: "", point: 0 },
    { option: "e", text: "", point: 0 },
  ]);
  const [optionsTF, setOptionsTF] = useState<MCOption[]>([
    { option: "a", text: "True", point: 1 },
    { option: "b", text: "False", point: 0 },
  ]);
  const [optionsMCMulti, setOptionsMCMulti] = useState<MCOption[]>([
    { option: "a", text: "", point: 0 },
    { option: "b", text: "", point: 0 },
    { option: "c", text: "", point: 0 },
  ]);
  const [optionsCategorized, setOptionsCategorized] = useState<
    CategorizedOption[]
  >([
    {
      text: "",
      point: 1,
      accurate: false,
      not_accurate: false,
      accurate_label: "",
      not_accurate_label: "",
    },
  ]);

  // ===== Mutations =====
  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();
  const [uploadFile] = useServiceUploadMutation();
  const submitting = creating || updating;

  const [hydrated, setHydrated] = useState(false);

  // ===== Hydrate (edit) =====
  useEffect(() => {
    if (!initial || hydrated) return;

    setCategoryId(initial.question_category_id ?? defaultCategoryId ?? null);
    setQuestion(initial.question ?? "");
    setType(initial.type as QuestionType);
    setAnswer(initial.answer ?? "");
    setTotalPoint(initial.total_point ?? 5);
    setExplanation(initial.explanation ?? "");

    const rawOptions = (initial as unknown as { options?: unknown }).options;

    if (Array.isArray(rawOptions)) {
      if (initial.type === "multiple_choice") {
        const cast = rawOptions as MCOption[];
        setOptionsMC(cast.length ? cloneMC(cast) : cloneMC(DEFAULT_OPTIONS_MC));
      } else if (initial.type === "true_false") {
        const cast = rawOptions as MCOption[];
        setOptionsTF(cast.length ? cloneMC(cast) : cloneMC(DEFAULT_OPTIONS_TF));
      } else if (initial.type === "multiple_choice_multiple_answer") {
        const cast = rawOptions as MCOption[];
        setOptionsMCMulti(
          cast.length ? cloneMC(cast) : cloneMC(DEFAULT_OPTIONS_MULTI)
        );
      } else if (initial.type === "multiple_choice_multiple_category") {
        const cast = rawOptions as CategorizedOption[];
        setOptionsCategorized(
          cast.length ? cloneCat(cast) : cloneCat(DEFAULT_OPTIONS_CATEGORIZED)
        );
      }
    }

    setHydrated(true);
  }, [initial, defaultCategoryId, hydrated]);

  // ===== Upload handler untuk SunEditor (3 argumen, return false) =====
  const handleSunUpload = useCallback(
    (
      files: File[],
      _info: object,
      uploadHandler: (data: {
        result?: { url: string; name?: string; size?: number }[];
        errorMessage?: string;
      }) => void
    ): boolean => {
      const file = files?.[0];
      if (!file) {
        uploadHandler({ errorMessage: "File tidak ditemukan" });
        return false;
      }

      // upload ke API kamu
      uploadFile(buildServiceUploadFormData({ file }))
        .unwrap()
        .then((res) => {
          // Gunakan helper yang sudah di luar
          const url = extractUrlFromResponse(res);

          if (!url) {
            // TAMBAHAN: Log untuk debugging
            console.error("Gagal extract URL dari respon API. Respon:", res);
            uploadHandler({
              errorMessage:
                "Upload berhasil tapi URL tidak ditemukan di response API. Cek console.",
            });
            return;
          }

          // kirim ke SunEditor
          uploadHandler({
            result: [
              {
                url,
                name: file.name,
                size: file.size,
              },
            ],
          });
        })
        .catch((err: unknown) => {
          console.error("Upload image gagal:", err); // TAMBAHAN: Log error
          uploadHandler({
            errorMessage:
              err instanceof Error ? err.message : "Upload gagal, coba lagi",
          });
        });

      // PENTING: stop upload bawaan editor
      return false;
    },
    [uploadFile]
  );

  // ===== Builder payload =====
  function buildPayload(): CreateQuestionPayload {
    if (!question_category_id) throw new Error("Kategori belum dipilih");

    switch (type) {
      case "multiple_choice":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
          options: optionsMC,
          answer,
        };

      case "true_false":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
          options: optionsTF,
          answer,
        };

      case "essay":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
          answer,
          total_point: totalPoint,
        };

      case "multiple_choice_multiple_answer":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
          options: optionsMCMulti,
          answer,
          total_point: totalPoint,
        };

      case "multiple_choice_multiple_category":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
          options: optionsCategorized,
          total_point: totalPoint,
        };

      case "matching":
        return {
          question_category_id,
          question,
          type,
          explanation: explanation || undefined,
        };
    }
  }

  // ===== Submit =====
  const handleSubmit = async () => {
    try {
      const payload = buildPayload();
      const saved =
        isEdit && initial
          ? await updateQuestion({ id: initial.id, payload }).unwrap()
          : await createQuestion(payload).unwrap();
      onSaved?.(saved);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan pertanyaan.");
    }
  };

  // ===== Render opsi =====
  const renderOptions = () => {
    if (type === "multiple_choice" || type === "true_false") {
      const state = type === "true_false" ? optionsTF : optionsMC;
      const setState = type === "true_false" ? setOptionsTF : setOptionsMC;

      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {state.map((opt, idx) => (
              <div key={idx} className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 uppercase">
                      {opt.option}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Point</span>
                    <Input
                      type="number"
                      className="w-24"
                      value={opt.point}
                      onChange={(e) => {
                        const v = [...state];
                        v[idx].point = Number(e.target.value || 0);
                        setState(v);
                      }}
                    />
                  </div>

                  {type === "multiple_choice" && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const v = [...state];
                        v.splice(idx, 1);
                        setState(v);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Label className="text-xs">Teks Opsi</Label>
                <SunEditor
                  setContents={opt.text}
                  onChange={(html: string) => {
                    const v = [...state];
                    v[idx].text = html;
                    setState(v);
                  }}
                  setOptions={{
                    minHeight: "120px",
                    maxHeight: "35vh",
                    buttonList: [
                      ["bold", "italic", "underline", "strike"],
                      ["fontColor", "hiliteColor"],
                      ["align", "list"],
                      ["link", "image"],
                      ["codeView"],
                    ],
                  }}
                  onImageUploadBefore={handleSunUpload}
                  onVideoUploadBefore={handleSunUpload}
                />
              </div>
            ))}

            {type === "multiple_choice" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const nextKey = String.fromCharCode(97 + state.length);
                  setState([...state, { option: nextKey, text: "", point: 0 }]);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Opsi
              </Button>
            )}

            <div className="grid gap-2">
              <Label>Jawaban Benar</Label>
              <Input
                placeholder={
                  type === "true_false"
                    ? "Isi: a (True) atau b (False)"
                    : "Contoh: a"
                }
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (type === "multiple_choice_multiple_answer") {
      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {optionsMCMulti.map((opt, idx) => (
              <div key={idx} className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-2 uppercase">
                      {opt.option}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Point</span>
                    <Input
                      type="number"
                      className="w-24"
                      value={opt.point}
                      onChange={(e) => {
                        const v = [...optionsMCMulti];
                        v[idx].point = Number(e.target.value || 0);
                        setOptionsMCMulti(v);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const v = [...optionsMCMulti];
                      v.splice(idx, 1);
                      setOptionsMCMulti(v);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Label className="text-xs">Teks Opsi</Label>
                <SunEditor
                  setContents={opt.text}
                  onChange={(html: string) => {
                    const v = [...optionsMCMulti];
                    v[idx].text = html;
                    setOptionsMCMulti(v);
                  }}
                  setOptions={{
                    minHeight: "120px",
                    buttonList: [
                      ["bold", "italic", "underline", "strike"],
                      ["fontColor", "hiliteColor"],
                      ["align", "list"],
                      ["link", "image"],
                      ["codeView"],
                    ],
                  }}
                  onImageUploadBefore={handleSunUpload}
                  onVideoUploadBefore={handleSunUpload}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const nextKey = String.fromCharCode(97 + optionsMCMulti.length);
                setOptionsMCMulti([
                  ...optionsMCMulti,
                  { option: nextKey, text: "", point: 0 },
                ]);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Opsi
            </Button>

            <div className="grid gap-2">
              <Label>Jawaban Benar (bisa banyak)</Label>
              <Input
                placeholder="Contoh: a,c,d"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Total Point</Label>
              <Input
                type="number"
                value={totalPoint}
                onChange={(e) => setTotalPoint(Number(e.target.value || 0))}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (type === "essay") {
      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-2">
              <Label>Jawaban</Label>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Jawaban esai"
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label>Total Point</Label>
              <Input
                type="number"
                className="w-32"
                value={totalPoint}
                onChange={(e) => setTotalPoint(Number(e.target.value || 0))}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (type === "multiple_choice_multiple_category") {
      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {optionsCategorized.map((opt, idx) => (
              <div key={idx} className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">Point</div>
                    <Input
                      type="number"
                      className="w-24"
                      value={opt.point}
                      onChange={(e) => {
                        const v = [...optionsCategorized];
                        v[idx].point = Number(e.target.value || 0);
                        setOptionsCategorized(v);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={opt.accurate}
                        onCheckedChange={(v) => {
                          const arr = [...optionsCategorized];
                          arr[idx].accurate = v;
                          if (v) arr[idx].not_accurate = false;
                          setOptionsCategorized(arr);
                        }}
                      />
                      <span className="text-sm">Akurat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={opt.not_accurate}
                        onCheckedChange={(v) => {
                          const arr = [...optionsCategorized];
                          arr[idx].not_accurate = v;
                          if (v) arr[idx].accurate = false;
                          setOptionsCategorized(arr);
                        }}
                      />
                      <span className="text-sm">Tidak Akurat</span>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const arr = [...optionsCategorized];
                        arr.splice(idx, 1);
                        setOptionsCategorized(arr);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Label className="text-xs">Teks</Label>
                <SunEditor
                  setContents={opt.text}
                  onChange={(html: string) => {
                    const arr = [...optionsCategorized];
                    arr[idx].text = html;
                    setOptionsCategorized(arr);
                  }}
                  setOptions={{
                    minHeight: "120px",
                    buttonList: [
                      ["bold", "italic", "underline", "strike"],
                      ["fontColor", "hiliteColor"],
                      ["align", "list"],
                      ["link", "image"],
                      ["codeView"],
                    ],
                  }}
                  onImageUploadBefore={handleSunUpload}
                  onVideoUploadBefore={handleSunUpload}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setOptionsCategorized([
                  ...optionsCategorized,
                  {
                    text: "",
                    point: 1,
                    accurate: false,
                    not_accurate: false,
                    accurate_label: "",
                    not_accurate_label: "",
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>

            <div className="grid gap-2">
              <Label>Total Point</Label>
              <Input
                type="number"
                className="w-32"
                value={totalPoint}
                onChange={(e) => setTotalPoint(Number(e.target.value || 0))}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Category */}
      <div className="grid gap-2">
        <Label>Kategori</Label>
        <Combobox<CategoryQuestion>
          value={question_category_id}
          onChange={setCategoryId}
          data={categories}
          placeholder="Pilih kategori"
          getOptionLabel={(i) => `${i.name} (${i.code})`}
        />
      </div>

      {/* Type */}
      <div className="grid gap-2">
        <Label>Tipe Soal</Label>
        <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
            <SelectItem value="essay">Essay</SelectItem>
            <SelectItem value="multiple_choice_multiple_answer">
              Pilihan Ganda Banyak Jawaban
            </SelectItem>
            <SelectItem value="multiple_choice_multiple_category">
              Kategori
            </SelectItem>
            <SelectItem value="true_false">True / False</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Question */}
      <div className="grid gap-2">
        <Label>Pertanyaan</Label>
        <SunEditor
          setContents={question}
          onChange={setQuestion}
          setOptions={{
            minHeight: "220px",
            buttonList: [
              ["undo", "redo"],
              ["bold", "italic", "underline", "strike", "removeFormat"],
              ["fontColor", "hiliteColor"],
              ["align", "list", "lineHeight"],
              ["link", "image", "table", "video"],
              ["codeView", "fullScreen"],
            ],
          }}
          onImageUploadBefore={handleSunUpload}
          onVideoUploadBefore={handleSunUpload}
        />
      </div>

      {/* Options per type */}
      {renderOptions()}

      {/* Explanation */}
      <div className="grid gap-2">
        <Label>Penjelasan (opsional)</Label>
        <SunEditor
          setContents={explanation}
          onChange={setExplanation}
          setOptions={{
            minHeight: "160px",
            buttonList: [
              ["bold", "italic", "underline", "strike", "removeFormat"],
              ["fontColor", "hiliteColor"],
              ["align", "list"],
              ["link", "image"],
              ["codeView"],
            ],
          }}
          onImageUploadBefore={handleSunUpload}
          onVideoUploadBefore={handleSunUpload}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => history.back()}
          disabled={submitting}
        >
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submittingText}
        </Button>
      </div>
    </div>
  );
}
