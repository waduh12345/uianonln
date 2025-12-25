"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionsForm from "@/components/form-modal/bank-questions-form/questions-form";
import { useGetQuestionCategoryListQuery } from "@/services/bank-questions/category-questions.service";
import { useGetQuestionByIdQuery } from "@/services/bank-questions/questions.service";
import { Loader2 } from "lucide-react";

export default function AddEditQuestionsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const categoryParam = sp.get("category_id");

  const questionId = idParam ? Number(idParam) : null;
  const defaultCategoryId = categoryParam ? Number(categoryParam) : null;

  const { data: catResp, isFetching: loadingCat } =
    useGetQuestionCategoryListQuery({
      page: 1,
      paginate: 100,
      search: "",
    });

  const categories = catResp?.data ?? [];

  const { data: initial, isFetching: loadingQuestion } =
    useGetQuestionByIdQuery(questionId ?? 0, {
      skip: !questionId,
      // 🆕 pastikan ambil data fresh saat masuk halaman edit
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
    });

  const loading = loadingCat || (!!questionId && loadingQuestion);

  return (
    <>
      <SiteHeader
        title={questionId ? "Edit Pertanyaan" : "Tambah Pertanyaan"}
      />

      <main className="mx-auto w-full max-w-5xl px-2 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              {questionId ? "Edit Pertanyaan" : "Tambah Pertanyaan"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Memuat…
              </div>
            ) : (
              <QuestionsForm
                key={questionId ?? "new"}
                categories={categories}
                initial={initial ?? null}
                defaultCategoryId={defaultCategoryId}
                onSaved={(saved) => {
                  router.push(
                    `/cms/questions?category_id=${saved.question_category_id}`
                  );
                }}
                submittingText={questionId ? "Simpan Perubahan" : "Simpan"}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}