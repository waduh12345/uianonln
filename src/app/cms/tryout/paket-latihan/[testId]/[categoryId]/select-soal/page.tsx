"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";

import { useCreateTestQuestionMutation } from "@/services/tryout/test-questions.service";
import { useGetQuestionListQuery } from "@/services/bank-questions/questions.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckSquare, Square, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import Pager from "@/components/ui/tryout-pagination";
import type { Questions } from "@/types/bank-questions/questions";

/** parse hanya menerima bilangan bulat positif */
const toPosInt = (seg: string | string[] | undefined): number => {
  const s = Array.isArray(seg) ? seg[0] : seg;
  if (!s || !/^\d+$/.test(s)) return 0;
  return parseInt(s, 10);
};

export default function SelectSoalPage() {
  const params = useParams<{ testId: string; categoryId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // param as string
  const testIdSeg = params?.testId;
  const catIdSeg = params?.categoryId;

  // sudah loaded jika keduanya adalah string
  const idsLoaded =
    typeof testIdSeg === "string" && typeof catIdSeg === "string";

  const testId = idsLoaded ? toPosInt(testIdSeg) : 0;
  const testQuestionCategoryId = idsLoaded ? toPosInt(catIdSeg) : 0;
  const hasValidIds = idsLoaded && testId > 0 && testQuestionCategoryId > 0;

  // kategori bank-soal (untuk filter otomatis)
  const questionCategoryId = toPosInt(searchParams.get("qcat") || undefined);
  const categoryName = searchParams.get("qcat_name") || "";

  const [page, setPage] = useState<number>(1);
  const [paginate, setPaginate] = useState<number>(10);
  const [search, setSearch] = useState<string>("");

  // list bank soal global, auto-filter by qcat
  const { data, isLoading, refetch } = useGetQuestionListQuery({
    page,
    paginate,
    search,
    question_category_id: questionCategoryId || undefined,
    orderBy: "questions.updated_at",
    order: "asc",
  });

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [create, { isLoading: saving }] = useCreateTestQuestionMutation();

  const list: Questions[] = useMemo(() => data?.data ?? [], [data]);
  const allIds = useMemo(() => list.map((q) => q.id), [list]);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected[id]);

  const toggleAll = (checked: boolean) => {
    const next: Record<number, boolean> = {};
    allIds.forEach((id) => (next[id] = checked));
    setSelected(next);
  };

  const submit = async () => {
    if (!hasValidIds) {
      await Swal.fire({
        icon: "error",
        title: "Parameter tidak valid",
        text: "Halaman belum memuat ID test/kategori dengan benar.",
      });
      return;
    }

    const question_ids = Object.keys(selected)
      .filter((k) => selected[Number(k)])
      .map((x) => Number(x));

    if (!question_ids.length) {
      await Swal.fire({ icon: "info", title: "Pilih soal dulu" });
      return;
    }

    try {
      await create({
        test_id: testId,
        test_question_category_id: testQuestionCategoryId,
        payload: { question_ids },
      }).unwrap();
      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Soal ditambahkan ke paket.",
      });
      setSelected({});
      refetch();
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Gagal", text: String(e) });
    }
  };

  return (
    <>
      <SiteHeader title="Pilih Soal" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-xl font-semibold">Bank Soal</h1>
            <div className="ml-2 text-sm text-muted-foreground">
              Kategori:{" "}
              <span className="font-medium">
                {categoryName ||
                  (questionCategoryId ? `#${questionCategoryId}` : "-")}
              </span>
            </div>
          </div>

          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Banner invalid hanya kalau param SUDAH loaded & invalid */}
        {idsLoaded && !hasValidIds && (
          <div className="text-sm text-red-600 border border-red-300 bg-red-50 rounded-md px-3 py-2">
            ID test/kategori pada URL tidak valid. Kembali ke halaman sebelumnya
            lalu buka lagi.
          </div>
        )}

        {/* Filter: search kiri, records kanan */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="w-full md:max-w-md flex gap-2">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  refetch();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setPage(1);
                refetch();
              }}
            >
              Reset
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Label>Records</Label>
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={paginate}
              onChange={(e) => {
                setPaginate(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 w-[64px]">
                  <Button
                    size="sm"
                    variant={allChecked ? "default" : "outline"}
                    onClick={() => toggleAll(!allChecked)}
                  >
                    {allChecked ? (
                      <CheckSquare className="h-4 w-4 mr-2" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    All
                  </Button>
                </th>
                <th className="p-3">Pertanyaan</th>
                <th className="p-3 w-40">Kategori</th>
                <th className="p-3 w-20">Point</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-4" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : list.length ? (
                list.map((q) => (
                  <tr key={q.id} className="border-t align-top">
                    <td className="p-3">
                      <Checkbox
                        checked={!!selected[q.id]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [q.id]: Boolean(v) }))
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: q.question }}
                      />
                    </td>
                    <td className="p-3">{q.category_name}</td>
                    <td className="p-3">{q.total_point}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4" colSpan={4}>
                    Tidak ada soal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager
          page={data?.current_page ?? 1}
          lastPage={data?.last_page ?? 1}
          onChange={setPage}
        />

        <div className="flex justify-end">
          <Button
            onClick={submit}
            disabled={saving || !hasValidIds || !questionCategoryId}
            title={
              !hasValidIds
                ? "ID test/kategori tidak valid"
                : !questionCategoryId
                ? "Kategori bank-soal tidak terdeteksi"
                : undefined
            }
          >
            Tambahkan ke Paket
          </Button>
        </div>
      </div>
    </>
  );
}