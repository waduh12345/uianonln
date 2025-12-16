"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";

import { jsPDF } from "jspdf";

import {
  useGetTestListQuery,
  useCreateTestMutation,
  useUpdateTestMutation,
  useDeleteTestMutation,
} from "@/services/tryout/test.service";
import { useExportTestMutation, useExportTestQuestionsMutation } from "@/services/tryout/export-test.service";
import { useGetSchoolListQuery } from "@/services/master/school.service";
import { useGetUsersListQuery } from "@/services/users-management.service";
import { useGetMeQuery } from "@/services/auth.service";
import type { Test } from "@/types/tryout/test";
import type { Users } from "@/types/user";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ListChecks,
  FileDown,
  PenLine,
  Trash2,
  Plus,
  RefreshCw,
  Trophy,
  Users as UsersIcon,
} from "lucide-react";
import Pager from "@/components/ui/tryout-pagination";
import ActionIcon from "@/components/ui/action-icon";
import { SiteHeader } from "@/components/site-header";
import { displayDate } from "@/lib/format-utils";
import TryoutForm, {
  FormState,
  TimerType,
  ScoreType,
  AssessmentType,
} from "@/components/form-modal/tryout-admin-form";
import { Combobox } from "@/components/ui/combo-box";
import TryoutMonitoringDialog from "@/components/modal/tryout/monitoring-student";

type School = { id: number; name: string; email?: string };

type TestRow = Test & {
  user_id?: number | null;
  pengawas_name?: string | null;
};

type TestPayload = {
  school_id: number;
  title: string;
  sub_title: string | null;
  shuffle_questions: boolean | number;
  timer_type: TimerType;
  score_type: ScoreType;
  total_time?: number;
  start_date?: string;
  end_date?: string;
  slug?: string;
  description?: string | null;
  total_questions?: number;
  pass_grade?: number;
  assessment_type?: AssessmentType;
  code?: string | null;
  max_attempts?: string | null;
  is_graded?: boolean;
  is_explanation_released?: boolean;
  user_id: number;
  status: number;
};

const emptyForm: FormState = {
  school_id: 0,
  title: "",
  sub_title: "",
  slug: "",
  description: "",
  total_time: 3600,
  total_questions: 0,
  pass_grade: 70,
  shuffle_questions: false,
  assessment_type: "irt",
  timer_type: "per_test",
  score_type: "default",
  start_date: "",
  end_date: "",
  code: "",
  max_attempts: "",
  is_graded: false,
  is_explanation_released: false,
  user_id: 0,
  status: 1,
};

function dateOnly(input?: string | null): string {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const s = String(input);
  if (s.includes("T") || s.includes(" ")) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ... imports

// --- TYPES FOR EXPORT RESPONSE ---
interface ExportOption {
  option: string; // "a", "b", etc
  text: string;
  point: number;
}

interface ExportQuestionDetail {
  id: number;
  question: string;
  type: string;
  answer: string; // "a", "b", etc
  options: ExportOption[];
}

interface ExportQuestionWrapper {
  id: number;
  question: ExportQuestionDetail;
}

interface ExportCategory {
  id: number;
  question_category: {
    name: string;
  };
  questions: ExportQuestionWrapper[];
}

interface ExportData {
  test: {
    title: string;
    sub_title: string | null;
    school_id: number;
  };
  question_categories: ExportCategory[];
}
// ---------------------------------

const htmlToText = (html: string) => {
  if (!html) return "";

  // 1. Ganti tag block-level umum dengan baris baru (\n)
  // Agar struktur paragraf tidak hilang saat tag di-strip
  const formattedHtml = html
    .replace(/<br\s*\/?>/gi, "\n")       // <br> jadi enter
    .replace(/<\/p>/gi, "\n\n")          // </p> jadi double enter
    .replace(/<\/div>/gi, "\n")          // </div> jadi enter
    .replace(/<\/li>/gi, "\n- ");        // </li> jadi enter + dash (untuk list)

  // 2. Gunakan DOM Parser browser untuk membersihkan sisa tag & entities (&nbsp;, dll)
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = formattedHtml;

  // 3. Ambil text content
  let text = tempDiv.textContent || tempDiv.innerText || "";

  // 4. Bersihkan spasi berlebih (optional, agar lebih rapi)
  // Mengubah multiple spaces menjadi satu spasi, tapi menjaga newline
  text = text.replace(/ +/g, ' ').trim(); 
  
  return text;
};

const generateRealPdf = (data: ExportData, schoolName: string) => {
  const { test, question_categories } = data;
  
  // 1. Inisialisasi jsPDF
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxLineWidth = pageWidth - margin * 2;
  
  let yPos = 20;

  // --- HEADER ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("DOKUMEN SOAL & KUNCI JAWABAN", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 7;
  doc.setFontSize(12);
  doc.text(test.title || "Ujian", pageWidth / 2, yPos, { align: "center" });

  if (test.sub_title) {
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(test.sub_title, pageWidth / 2, yPos, { align: "center" });
  }
  
  yPos += 6;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Institusi: ${schoolName} | Tgl Cetak: ${new Date().toLocaleDateString("id-ID")}`, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0);

  yPos += 4;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 10;

  // --- CONTENT LOOP ---
  let globalNo = 1;

  // Loop setiap kategori soal
  question_categories.forEach((cat) => {
    // Cek space untuk judul kategori
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }

    // Render Judul Kategori (Opsional, jika ingin dipisah per kategori)
    if (cat.question_category?.name) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Kategori: ${cat.question_category.name}`, margin, yPos);
      yPos += 8;
    }

    // Loop setiap pertanyaan dalam kategori
    cat.questions.forEach((qWrapper) => {
      const q = qWrapper.question;

      // Cek apakah halaman cukup untuk soal + opsi (estimasi kasar)
      if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }

      // 1. Render Teks Soal
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${globalNo}.`, margin, yPos); // Nomor soal
      
      doc.setFont("helvetica", "normal");
      // Membersihkan tag HTML sederhana jika ada (misal <p>)
      // const cleanQuestionText = q.question.replace(/<[^>]+>/g, ''); 
      const cleanQuestionText = htmlToText(q.question);
      const splitText = doc.splitTextToSize(cleanQuestionText, maxLineWidth - 10);
      doc.text(splitText, margin + 8, yPos);
      
      yPos += (splitText.length * 5) + 2;

      // 2. Render Pilihan Jawaban
      q.options.forEach((opt) => {
        // Cek page break di tengah opsi
        if (yPos > pageHeight - 15) { doc.addPage(); yPos = 20; }
        
        const isCorrect = opt.option.toLowerCase() === q.answer.toLowerCase();
        
        // Logic styling jawaban benar
        if(isCorrect) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 150, 0); // Hijau untuk jawaban benar
        } else {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0);
        }
        
        const optText = `${opt.option.toUpperCase()}. ${opt.text}`;
        // Wrap text opsi jika terlalu panjang
        const splitOpt = doc.splitTextToSize(optText, maxLineWidth - 15);
        doc.text(splitOpt, margin + 12, yPos);
        
        yPos += (splitOpt.length * 5) + 1;
      });

      // Reset warna ke hitam
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      yPos += 6; // Spasi antar soal
      globalNo++;
    });

    yPos += 5; // Spasi antar kategori
  });

  // Footer Page Number
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - margin, pageHeight - 10, {align:'right'});
  }

  // Simpan File
  const safeName = test.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`soal_${safeName}.pdf`);
};

export default function TryoutPage() {
  const [page, setPage] = useState(1);
  const [paginate, setPaginate] = useState(10);
  const [search, setSearch] = useState("");
  const [searchBySpecific, setSearchBySpecific] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");

  const { data: me } = useGetMeQuery();
  const roles = me?.roles ?? [];
  const isSuperadmin = roles.some((r) => r.name === "superadmin");
  const isPengawas = roles.some((r) => r.name === "pengawas");
  const myId = me?.id ?? 0;

  const { data: schoolResp, isLoading: loadingSchools } = useGetSchoolListQuery(
    { page: 1, paginate: 100, search: schoolSearch || "" }
  );
  const schools: School[] = useMemo(() => schoolResp?.data ?? [], [schoolResp]);

  const baseQuery = {
    page,
    paginate,
    search,
    searchBySpecific,
    orderBy: "tests.updated_at",
    orderDirection: "desc" as const,
    school_id: schoolId ?? undefined,
  };

  const finalQuery =
    !isSuperadmin && isPengawas
      ? {
          ...baseQuery,
          searchBySpecific: "user_id" as const,
          search: String(myId),
        }
      : baseQuery;

  const { data, isLoading, refetch } = useGetTestListQuery(finalQuery);

  const { data: pengawasResp } = useGetUsersListQuery({
    page: 1,
    paginate: 200,
    search: "",
    role_id: 3,
  });
  const pengawasMap = useMemo(() => {
    const m = new Map<number, string>();
    (pengawasResp?.data ?? []).forEach((u: Users) => m.set(u.id, u.name));
    return m;
  }, [pengawasResp]);

  const [createTest, { isLoading: creating }] = useCreateTestMutation();
  const [updateTest, { isLoading: updating }] = useUpdateTestMutation();
  const [deleteTest] = useDeleteTestMutation();
  const [exportTest] = useExportTestMutation();
  const [exportTestQuestions] = useExportTestQuestionsMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestRow | null>(null);

  const [monitoringTest, setMonitoringTest] = useState<TestRow | null>(null);

  const toForm = (t: TestRow): FormState => ({
    school_id: t.school_id,
    title: t.title,
    sub_title: t.sub_title ?? "",
    slug: t.slug ?? "",
    description: t.description ?? "",
    total_time: t.total_time,
    total_questions: t.total_questions,
    pass_grade: t.pass_grade,
    shuffle_questions: t.shuffle_questions,
    assessment_type: t.assessment_type as AssessmentType,
    timer_type: t.timer_type as TimerType,
    score_type: (t.score_type as ScoreType) ?? "default",
    start_date: dateOnly(t.start_date),
    end_date: dateOnly(t.end_date),
    code: t.code ?? "",
    max_attempts: t.max_attempts ?? "",
    is_graded: t.is_graded,
    is_explanation_released: t.is_explanation_released,
    user_id: t.user_id ?? 0,
    status: t.status ? 1 : 0,
  });

  const toPayload = (f: FormState): TestPayload => {
    const payload: TestPayload = {
      school_id: f.school_id,
      title: f.title,
      sub_title: f.sub_title || null,
      shuffle_questions: f.shuffle_questions ? 1 : 0,
      timer_type: f.timer_type,
      score_type: f.score_type,
      slug: f.slug,
      description: f.description,
      total_questions: f.total_questions,
      pass_grade: f.pass_grade,
      assessment_type: f.assessment_type,
      code: f.code || "",
      max_attempts: f.max_attempts || "",
      is_graded: f.is_graded,
      is_explanation_released: f.is_explanation_released,
      user_id: Number(f.user_id || 0),
      status: Number(f.status || 0),
    };

    if (f.timer_type === "per_test") {
      payload.total_time = Number(f.total_time || 0);
    }

    const sd = dateOnly(f.start_date);
    const ed = dateOnly(f.end_date);
    if (sd) payload.start_date = sd;
    if (ed) payload.end_date = ed;

    return payload;
  };

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (t: TestRow) => {
    setEditing(t);
    setOpen(true);
  };

  const onSubmit = async (values: FormState): Promise<boolean> => {
    const fixedValues =
      !isSuperadmin && isPengawas ? { ...values, user_id: myId } : values;

    try {
      let res: { title: string };

      if (editing) {
        res = await updateTest({
          id: editing.id,
          payload: toPayload(fixedValues),
        }).unwrap();
      } else {
        res = await createTest(toPayload(fixedValues)).unwrap();
      }

      // ⬇️ TUTUP modal dulu
      setOpen(false);
      setEditing(null);
      refetch();

      // ⬇️ baru munculin alert di tick berikutnya biar focus trapnya sudah lepas
      setTimeout(() => {
        void Swal.fire({
          icon: "success",
          title: editing ? "Updated" : "Created",
          text: `Test "${res.title}" ${editing ? "diperbarui" : "dibuat"}.`,
        });
      }, 30);

      return true;
    } catch (e) {
      // ⬇️ kalau ERROR modal TETAP TERBUKA
      setTimeout(() => {
        void Swal.fire({
          icon: "error",
          title: "Gagal",
          text: e instanceof Error ? e.message : String(e),
        });
      }, 30);

      return false;
    }
  };

  const onDelete = async (id: number, label: string) => {
    const ask = await Swal.fire({
      icon: "warning",
      title: "Hapus Test?",
      text: `Data "${label}" akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });
    if (!ask.isConfirmed) return;
    try {
      await deleteTest(id).unwrap();
      await Swal.fire({
        icon: "success",
        title: "Terhapus",
        text: `"${label}" dihapus.`,
      });
      refetch();
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Gagal", text: String(e) });
    }
  };

  const onExport = async (id: number) => {
    try {
      setExportingId(id);
      const res = await exportTest({ test_id: id }).unwrap();
      await Swal.fire({
        icon: "success",
        title: "Export dimulai",
        text: res.data || res.message,
      });
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Export gagal",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExportingId(null);
    }
  };

  const onExportPdf = async (id: number) => {
    // Cari data test di tabel hanya untuk mendapatkan nama sekolah (karena di API export detail sekolahnya minim)
    const selectedTest = tableRows.find((t) => t.id === id);
    const schoolName = selectedTest?.school_name || "Sekolah Umum";

    try {
      setExportingId(id);
      // Panggil API
      const res = await exportTestQuestions({ test_id: id }).unwrap();
      
      // Validasi data sebelum generate
      if (res?.data) {
         // CASTING ke tipe ExportData agar TypeScript senang
         const exportData = res.data as unknown as ExportData;
         
         // Generate PDF dengan data REAL
         generateRealPdf(exportData, schoolName);

         await Swal.fire({
            icon: "success",
            title: "Download Berhasil",
            text: "File PDF telah berhasil di-generate.",
            timer: 2000,
            showConfirmButton: false
         });
      } else {
        throw new Error("Data soal tidak ditemukan");
      }

    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Export gagal",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExportingId(null);
    }
  };

  const tableRows: TestRow[] = useMemo(
    () => (data?.data as TestRow[]) ?? [],
    [data]
  );

  return (
    <>
      <SiteHeader title="Ujian Online" />
      {open && (
        <div className="fixed inset-0 z-40 pointer-events-auto">
          <div className="absolute inset-0 bg-slate-950/55" />
          <div className="absolute -top-32 -right-10 h-72 w-72 rounded-full bg-black/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-black/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>
      )}
      <div className="p-4 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Daftar Ujian Online</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Buat Ujian Online
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex items-center gap-2">
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
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="ml-auto w-full flex gap-2">
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refetch()}
                />

                <div className="flex items-center gap-2 w-full md:w-80">
                  <div className="flex w-full gap-2">
                    <Combobox<School>
                      value={schoolId}
                      onChange={(v) => {
                        setSchoolId(v);
                        setPage(1);
                      }}
                      onSearchChange={setSchoolSearch}
                      data={schools}
                      isLoading={loadingSchools}
                      placeholder="Semua Prodi"
                      getOptionLabel={(s) => s.name}
                    />
                    {schoolId !== null && (
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setSchoolId(null);
                          setPage(1);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    if (isSuperadmin) {
                      setSearchBySpecific("");
                    }
                    setSchoolId(null);
                    setPage(1);
                    refetch();
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Judul</th>
                    <th className="p-3">Prodi</th>
                    <th className="p-3">Pengawas</th>
                    <th className="p-3">Waktu (detik)</th>
                    <th className="p-3">Shuffle</th>
                    <th className="p-3">Mulai</th>
                    <th className="p-3">Berakhir</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="p-4" colSpan={10}>
                        Loading…
                      </td>
                    </tr>
                  ) : tableRows.length ? (
                    tableRows.map((t) => {
                      const name =
                        t.pengawas_name ??
                        (t.user_id ? pengawasMap.get(t.user_id) : undefined) ??
                        "-";
                      return (
                        <tr key={t.id} className="border-t align-top">
                          <td className="p-3">
                            <div className="font-medium">{t.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.sub_title || "-"}
                            </div>
                          </td>
                          <td className="p-3">{t.school_name}</td>
                          <td className="p-3">{name}</td>
                          <td className="p-3">
                            {t.timer_type === "per_category" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              t.total_time
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                t.shuffle_questions ? "default" : "secondary"
                              }
                            >
                              {t.shuffle_questions ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {t.start_date ? displayDate(t.start_date) : "-"}
                          </td>
                          <td className="p-3">
                            {t.end_date ? displayDate(t.end_date) : "-"}
                          </td>
                            <td className="p-3">
                            {t.status === true ? (
                              <Badge variant="success">Aktif</Badge>
                            ) : (
                              <Badge variant="destructive">Non-aktif</Badge>
                            )}
                            </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Link
                                href={`/cms/tryout/paket-latihan/${t.id}/questions-category`}
                              >
                                <ActionIcon label="Bank Soal">
                                  <ListChecks className="h-4 w-4" />
                                </ActionIcon>
                              </Link>

                              <Link href={`/cms/tryout/rank?test_id=${t.id}`}>
                                <ActionIcon label="Rank">
                                  <Trophy className="h-4 w-4" />
                                </ActionIcon>
                              </Link>

                              <ActionIcon
                                label="Monitoring Peserta"
                                onClick={() => {
                                  setMonitoringTest(t);
                                }}
                              >
                                <UsersIcon className="h-4 w-4" />
                              </ActionIcon>

                              <ActionIcon
                                label="Export"
                                onClick={() => onExport(t.id)}
                                disabled={exportingId === t.id}
                              >
                                <FileDown className="h-4 w-4" />
                              </ActionIcon>

                              <ActionIcon
                                label="Download PDF"
                                onClick={() => onExportPdf(t.id)}
                                disabled={exportingId === t.id}
                              >
                                <FileDown className="h-4 w-4" />
                              </ActionIcon>

                              <ActionIcon
                                label="Edit"
                                onClick={() => openEdit(t)}
                              >
                                <PenLine className="h-4 w-4" />
                              </ActionIcon>
                              <ActionIcon
                                label="Hapus"
                                onClick={() => onDelete(t.id, t.title)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </ActionIcon>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-4" colSpan={10}>
                        Tidak ada data.
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
          </CardContent>
        </Card>

        <Dialog
          open={open}
          modal={false}
          onOpenChange={(v) => {
            if (!v) setEditing(null);
            setOpen(v);
          }}
        >
          <DialogContent
            withOverlay={false}
            className="z-50 max-h-[98vh] overflow-y-auto sm:max-w-2xl md:max-w-3xl xl:max-w-5xl"
          >
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? "Form Ubah Ujian Online"
                  : "Form Tambah Ujian Online"}
              </DialogTitle>
            </DialogHeader>

            <TryoutForm
              key={editing ? editing.id : "new"}
              initial={
                editing
                  ? toForm(editing)
                  : !isSuperadmin && isPengawas
                  ? { ...emptyForm, user_id: myId }
                  : emptyForm
              }
              submitting={creating || updating}
              onCancel={() => {
                setOpen(false);
                setEditing(null);
              }}
              onSubmit={async (values) => {
                await onSubmit(values);
              }}
            />
          </DialogContent>
        </Dialog>

        <TryoutMonitoringDialog
          open={!!monitoringTest}
          onOpenChange={(v) => {
            if (!v) {
              setMonitoringTest(null);
            }
          }}
          test={
            monitoringTest
              ? { id: monitoringTest.id, title: monitoringTest.title }
              : null
          }
          isSuperadmin={isSuperadmin}
          myId={myId}
        />
      </div>
    </>
  );
}
