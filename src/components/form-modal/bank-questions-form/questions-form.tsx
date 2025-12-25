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
  if (
    typeof res === "string" &&
    (res.startsWith("http") || res.startsWith("/"))
  ) {
    return res;
  }

  if (typeof res !== "object" || res === null) return "";
  const obj = res as Record<string, unknown>;

  if (typeof obj.data === "string") return obj.data;
  if (typeof obj.url === "string") return obj.url;
  if (typeof obj.file_url === "string") return obj.file_url;
  if (typeof obj.location === "string") return obj.location;

  if (typeof obj.data === "object" && obj.data !== null) {
    const dataObj = obj.data as Record<string, unknown>;
    if (typeof dataObj.url === "string") return dataObj.url;
    if (typeof dataObj.file_url === "string") return dataObj.file_url;
    if (typeof dataObj.location === "string") return dataObj.location;
  }

  return "";
};

/* ===== DEFAULT OPTIONS + CLONE HELPERS ===== */

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

type Props = {
  categories: CategoryQuestion[];
  initial?: Questions | null;
  defaultCategoryId: number | null;
  onSaved?: (saved: Questions) => void;
  submittingText?: string;
};

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

  const editorKeyBase = isEdit && initial ? `q-${initial.id}` : "q-new";

  // ===== OPTIONS STATE (pakai clone supaya nggak read-only) =====
  const [optionsMC, setOptionsMC] = useState<MCOption[]>(() =>
    cloneMC(DEFAULT_OPTIONS_MC)
  );
  const [optionsTF, setOptionsTF] = useState<MCOption[]>(() =>
    cloneMC(DEFAULT_OPTIONS_TF)
  );
  const [optionsMCMulti, setOptionsMCMulti] = useState<MCOption[]>(() =>
    cloneMC(DEFAULT_OPTIONS_MULTI)
  );
  const [optionsCategorized, setOptionsCategorized] = useState<
    CategorizedOption[]
  >(() => cloneCat(DEFAULT_OPTIONS_CATEGORIZED));

  // ===== Mutations =====
  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();
  const [uploadFile] = useServiceUploadMutation();
  const submitting = creating || updating;

  // ===== Hydrate (edit) =====
  const [hydrated, setHydrated] = useState(false);

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

  // ===== Upload handler =====
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

      uploadFile(buildServiceUploadFormData({ file }))
        .unwrap()
        .then((res) => {
          const url = extractUrlFromResponse(res);
          if (!url) {
            console.error("Gagal extract URL dari respon API. Respon:", res);
            uploadHandler({
              errorMessage:
                "Upload berhasil tapi URL tidak ditemukan di response API. Cek console.",
            });
            return;
          }

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
          console.error("Upload image gagal:", err);
          uploadHandler({
            errorMessage:
              err instanceof Error ? err.message : "Upload gagal, coba lagi",
          });
        });

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
                      onChange={(e) =>
                        setState((prev) => {
                          const v = prev.map((o) => ({ ...o }));
                          v[idx].point = Number(e.target.value || 0);
                          return v;
                        })
                      }
                    />
                  </div>

                  {type === "multiple_choice" && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setState((prev) => {
                          const v = prev.map((o) => ({ ...o }));
                          v.splice(idx, 1);
                          return v;
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Label className="text-xs">Teks Opsi</Label>
                <SunEditor
                  key={`${editorKeyBase}-opt-${type}-${idx}`}
                  setContents={opt.text}
                  onChange={(html: string) =>
                    setState((prev) => {
                      const v = prev.map((o) => ({ ...o }));
                      v[idx].text = html;
                      return v;
                    })
                  }
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
                onClick={() =>
                  setState((prev) => {
                    const cloned = prev.map((o) => ({ ...o }));
                    const nextKey = String.fromCharCode(97 + cloned.length);
                    cloned.push({ option: nextKey, text: "", point: 0 });
                    return cloned;
                  })
                }
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
                      onChange={(e) =>
                        setOptionsMCMulti((prev) => {
                          const v = prev.map((o) => ({ ...o }));
                          v[idx].point = Number(e.target.value || 0);
                          return v;
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setOptionsMCMulti((prev) => {
                        const v = prev.map((o) => ({ ...o }));
                        v.splice(idx, 1);
                        return v;
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Label className="text-xs">Teks Opsi</Label>
                <SunEditor
                  key={`${editorKeyBase}-opt-${type}-${idx}`}
                  setContents={opt.text}
                  onChange={(html: string) =>
                    setOptionsMCMulti((prev) => {
                      const v = prev.map((o) => ({ ...o }));
                      v[idx].text = html;
                      return v;
                    })
                  }
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
                setOptionsMCMulti((prev) => {
                  const v = prev.map((o) => ({ ...o }));
                  const nextKey = String.fromCharCode(97 + v.length);
                  v.push({ option: nextKey, text: "", point: 0 });
                  return v;
                })
              }
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
                      onChange={(e) =>
                        setOptionsCategorized((prev) => {
                          const v = prev.map((o) => ({ ...o }));
                          v[idx].point = Number(e.target.value || 0);
                          return v;
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={opt.accurate}
                        onCheckedChange={(v) =>
                          setOptionsCategorized((prev) => {
                            const arr = prev.map((o) => ({ ...o }));
                            arr[idx].accurate = v;
                            if (v) arr[idx].not_accurate = false;
                            return arr;
                          })
                        }
                      />
                      <span className="text-sm">Benar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={opt.not_accurate}
                        onCheckedChange={(v) =>
                          setOptionsCategorized((prev) => {
                            const arr = prev.map((o) => ({ ...o }));
                            arr[idx].not_accurate = v;
                            if (v) arr[idx].accurate = false;
                            return arr;
                          })
                        }
                      />
                      <span className="text-sm">Salah</span>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setOptionsCategorized((prev) => {
                          const arr = prev.map((o) => ({ ...o }));
                          arr.splice(idx, 1);
                          return arr;
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Label className="text-xs">Teks</Label>
                <SunEditor
                  key={`${editorKeyBase}-opt-${type}-${idx}`}
                  setContents={opt.text}
                  onChange={(html: string) =>
                    setOptionsCategorized((prev) => {
                      const arr = prev.map((o) => ({ ...o }));
                      arr[idx].text = html;
                      return arr;
                    })
                  }
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

                <div className="grid gap-2 mt-2">
                  <Label className="text-xs">Label Benar</Label>
                  <Input
                    type="text"
                    value={opt.accurate_label}
                    onChange={(e) =>
                      setOptionsCategorized((prev) => {
                        const arr = prev.map((o) => ({ ...o }));
                        arr[idx].accurate_label = e.target.value;
                        return arr;
                      })
                    }
                    placeholder="Label untuk Benar"
                  />
                </div>
                <div className="grid gap-2 mt-2">
                  <Label className="text-xs">Label Salah</Label>
                  <Input
                    type="text"
                    value={opt.not_accurate_label}
                    onChange={(e) =>
                      setOptionsCategorized((prev) => {
                        const arr = prev.map((o) => ({ ...o }));
                        arr[idx].not_accurate_label = e.target.value;
                        return arr;
                      })
                    }
                    placeholder="Label untuk Salah"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setOptionsCategorized((prev) => {
                  const arr = prev.map((o) => ({ ...o }));
                  arr.push({
                    text: "",
                    point: 1,
                    accurate_label: "",
                    not_accurate_label: "",
                    accurate: false,
                    not_accurate: false,
                  });
                  return arr;
                })
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
              Pilihan Ganda Kompleks MCMA
            </SelectItem>
            <SelectItem value="multiple_choice_multiple_category">
              Pilihan Ganda Kompleks Kategori
            </SelectItem>
            <SelectItem value="true_false">True / False</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Question */}
      <div className="grid gap-2">
        <Label>Pertanyaan</Label>
        <SunEditor
          key={`${editorKeyBase}-question`}
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
          key={`${editorKeyBase}-explanation`}
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