"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Upload,
  FileDown,
} from "lucide-react";

import { Combobox } from "@/components/ui/combo-box";
import type { CategoryQuestion } from "@/types/bank-questions/category-questions";
import type { Questions } from "@/types/bank-questions/questions";

import { useGetQuestionCategoryListQuery } from "@/services/bank-questions/category-questions.service";
import {
  useGetQuestionListQuery,
  useDeleteQuestionMutation,
  useGetQuestionImportTemplateQuery,
  useImportQuestionsMutation,
  useExportQuestionsMutation,
} from "@/services/bank-questions/questions.service";
import RichTextView from "@/components/ui/rich-text-view";

/* ---------- SweetAlert helpers ---------- */
type AlertIcon = "success" | "error" | "info" | "warning" | "question";

const toast = (icon: AlertIcon, title: string, text?: string) => {
  void Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    text,
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
  });
};

const confirmDialog = async (
  title: string,
  text?: string,
  confirmText = "Ya, hapus",
  cancelText = "Batal"
): Promise<boolean> => {
  const res = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
  });
  return res.isConfirmed;
};

const getErrMsg = (e: unknown): string => {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const msg =
      (e as { message?: string }).message ??
      (e as { data?: { message?: string } }).data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Terjadi kesalahan.";
};

export default function QuestionsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // hydrate dari url
  useEffect(() => {
    const cid = sp.get("category_id");
    setCategoryId(cid ? Number(cid) : null);
  }, [sp]);

  // tulis balik ke url
  useEffect(() => {
    const curr = new URLSearchParams(sp.toString());
    if (categoryId) curr.set("category_id", String(categoryId));
    else curr.delete("category_id");
    router.replace(`/cms/questions?${curr.toString()}`);
  }, [categoryId, router, sp]);

  // category
  const {
    data: catResp,
    isFetching: loadingCat,
    refetch: refetchCat,
  } = useGetQuestionCategoryListQuery({
    page: 1,
    paginate: 50,
    search: "",
  });
  const categories: CategoryQuestion[] = catResp?.data ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  // questions
  const {
    data: qResp,
    isFetching,
    refetch,
  } = useGetQuestionListQuery(
    {
      page,
      paginate: 10,
      search: query,
      question_category_id: categoryId || undefined,
      orderBy: "questions.updated_at",
      order: "asc",
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    }
  );

  const [remove] = useDeleteQuestionMutation();

  // import/export
  const { data: templateUrl } = useGetQuestionImportTemplateQuery();
  const [importQuestions, { isLoading: importing }] =
    useImportQuestionsMutation();
  const [exportQuestions, { isLoading: exporting }] =
    useExportQuestionsMutation();

  const fileRef = useRef<HTMLInputElement | null>(null);

  // debounce search
  useMemo(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const allRows: Questions[] = qResp?.data ?? [];
  const rows = useMemo(() => {
    if (!categoryId) return [];
    return allRows.filter((r) => {
      const byId =
        (r as unknown as { question_category_id?: number })
          ?.question_category_id === categoryId;
      if (byId) return true;
      if (
        selectedCategory?.name &&
        (r as unknown as { category_name?: string })?.category_name
      ) {
        return r.category_name === selectedCategory.name;
      }
      return false;
    });
  }, [allRows, categoryId, selectedCategory]);

  const lastPage = qResp?.last_page ?? 1;
  const total = rows.length;

  // aksi
  const handleDelete = async (id: number) => {
    const ok = await confirmDialog(
      "Hapus pertanyaan ini?",
      "Aksi ini tidak bisa dibatalkan."
    );
    if (!ok) return;

    try {
      await remove(id).unwrap();
      toast("success", "Berhasil dihapus");
      refetch();
    } catch (e: unknown) {
      toast("error", "Gagal menghapus", getErrMsg(e));
    }
  };

  const triggerImport = () => {
    if (!categoryId) {
      toast("info", "Pilih kategori terlebih dahulu");
      return;
    }
    fileRef.current?.click();
  };

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!categoryId) {
      toast("info", "Pilih kategori terlebih dahulu");
      return;
    }
    try {
      const resp = await importQuestions({
        file,
        question_category_id: categoryId,
      }).unwrap();
      const msg =
        (typeof resp?.data === "string" && resp.data) ||
        resp?.message ||
        "Import diproses.";
      toast("success", "Success", msg);
      refetch();
    } catch (err: unknown) {
      toast("error", "Gagal memulai import", getErrMsg(err));
    }
  };

  const handleExport = async () => {
    if (!categoryId) {
      toast("info", "Pilih kategori terlebih dahulu");
      return;
    }
    try {
      const resp = await exportQuestions({
        question_category_id: categoryId,
      }).unwrap();
      const msg =
        (typeof resp?.data === "string" && resp.data) ||
        resp?.message ||
        "Export diproses.";
      toast("success", "Success", msg);
    } catch (err: unknown) {
      toast("error", "Gagal memulai export", getErrMsg(err));
    }
  };

  return (
    <>
      <SiteHeader title="Bank Soal" />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Card className="border-border/70">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">
                Daftar Pertanyaan
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Pilih kategori untuk menampilkan pertanyaan & melakukan CRUD.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onImportFileChange}
              />

              <Button
                variant="outline"
                onClick={triggerImport}
                disabled={!categoryId || importing}
                title={categoryId ? "Import soal" : "Pilih kategori dulu"}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>

              <a
                href={templateUrl ?? "#"}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!templateUrl) {
                    e.preventDefault();
                    toast("info", "Template belum tersedia");
                  }
                }}
              >
                <Button variant="outline" title="Unduh Template Import">
                  <FileDown className="mr-2 h-4 w-4" />
                  Template
                </Button>
              </a>

              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!categoryId || exporting}
                title={categoryId ? "Mulai export" : "Pilih kategori dulu"}
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>

              <Button
                variant="outline"
                size="icon"
                title="Refresh"
                onClick={() => {
                  refetch();
                  refetchCat();
                  toast("info", "Memuat ulang data…");
                }}
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

              <Link
                href={
                  categoryId
                    ? `/cms/questions/add-edit?category_id=${categoryId}`
                    : "#"
                }
                aria-disabled={!categoryId}
                className={!categoryId ? "pointer-events-none opacity-50" : ""}
              >
                <Button disabled={!categoryId}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Filter bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <span className="text-xs font-medium">Kategori</span>
                <Combobox<CategoryQuestion>
                  value={categoryId}
                  onChange={(v) => {
                    setCategoryId(v);
                    setPage(1);
                  }}
                  data={categories}
                  isLoading={loadingCat}
                  placeholder="Pilih kategori…"
                  getOptionLabel={(i) => `${i.name} (${i.code})`}
                />
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-medium">Pencarian</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Cari pertanyaan…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* List */}
            {!categoryId ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                Pilih kategori terlebih dahulu.
              </div>
            ) : isFetching && rows.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat data…
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                Tidak ada data.
              </div>
            ) : (
              <div className="space-y-4">
                {rows.map((q) => (
                  <Card key={q.id} className="overflow-hidden">
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {q.type.replaceAll("_", " ")}
                          </Badge>
                          <Badge variant="outline">
                            {selectedCategory?.name}
                          </Badge>
                        </div>

                        {/* ⬇️ render HTML supaya img/video muncul */}
                        <RichTextView html={q.question} />
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/cms/questions/add-edit?id=${q.id}&category_id=${categoryId}`}
                            >
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(q.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {q.type === "essay" ? (
                        <>
                          <div className="text-xs text-muted-foreground">
                            Kunci jawaban
                          </div>
                          <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">
                            {q.answer || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total point
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            {q.total_point ?? "-"}
                          </div>
                        </>
                      ) : q.type === "multiple_choice_multiple_category" ? (
                        <div className="text-sm text-muted-foreground">
                          (Detail opsi/penilaian kategori tidak tersedia di
                          interface ringkas. Tampilkan dari endpoint detail jika
                          diperlukan.)
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-muted-foreground">
                            Jawaban
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            {q.answer || "-"}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Total (setelah filter kategori): {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <div className="text-sm">
                  Page {page} / {lastPage}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}