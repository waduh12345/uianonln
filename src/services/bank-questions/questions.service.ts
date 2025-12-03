import { apiSlice } from "@/services/base-query";
import type { Questions } from "@/types/bank-questions/questions";

/** ===== Shared Types (NO any) ===== */
export type QuestionType =
  | "multiple_choice"
  | "essay"
  | "true_false"
  | "multiple_choice_multiple_answer"
  | "matching"
  | "multiple_choice_multiple_category";

export interface MCOption {
  option: string;
  text: string; // HTML allowed (rich text)
  point: number;
}

export interface CategorizedOption {
  text: string; // HTML allowed
  point: number;
  accurate: boolean;
  not_accurate: boolean;
}

export interface BaseQuestionPayload {
  question_category_id: number;
  question: string; // HTML allowed
  type: QuestionType;
  explanation?: string; // HTML allowed
  total_point?: number; // if required by the type
  answer?: string; // if required by the type
  options?: unknown[]; // specialized in unions below
}

/** ===== Strongly-typed payload unions ===== */
export type CreateQuestionPayload =
  | (Omit<BaseQuestionPayload, "options" | "answer" | "total_point"> & {
      type: "multiple_choice";
      options: MCOption[];
      answer: string; // e.g., "a"
    })
  | (Omit<BaseQuestionPayload, "options" | "answer" | "total_point"> & {
      type: "true_false";
      options: MCOption[]; // two options (a/b)
      answer: string; // "a" or "b"
    })
  | (Omit<BaseQuestionPayload, "options"> & {
      type: "essay";
      answer: string;
      total_point: number;
    })
  | (Omit<BaseQuestionPayload, "options"> & {
      type: "multiple_choice_multiple_answer";
      options: MCOption[];
      answer: string; // e.g., "a,c,d"
      total_point: number;
    })
  | (Omit<BaseQuestionPayload, "answer"> & {
      type: "multiple_choice_multiple_category";
      options: CategorizedOption[];
      total_point: number;
    })
  | (BaseQuestionPayload & {
      type: "matching";
      // TODO: define exact shape once backend format is final
    });

export type UpdateQuestionPayload = CreateQuestionPayload;

/** ===== List args (incl. lampiran params) ===== */
export interface GetQuestionListArgs {
  page: number;
  paginate: number;
  search?: string;
  /** kolom spesifik yang ingin dicari, contoh: "question_category_id" */
  searchBySpecific?: string;
  /** filter langsung by category id (sesuai lampiran) */
  question_category_id?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

/** ===== Import/Export (Questions) ===== */
export type QuestionExportPayload = {
  /** dipilih dari combobox `useGetQuestionCategoryListQuery` */
  question_category_id: number;
};

export type QuestionImportPayload = {
  /** sama dengan export, kategori tempat data diimpor */
  question_category_id: number;
  file: File;
};

/** URL template CSV bawaan dari requirement */
export const QUESTION_IMPORT_TEMPLATE_URL =
  "https://api-cbt.naditechno.id/question-import.csv";

/** ===== API ===== */
export const questionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // List (paginated + optional search & specific filters)
    getQuestionList: builder.query<
      {
        data: Questions[];
        last_page: number;
        current_page: number;
        total: number;
        per_page: number;
      },
      GetQuestionListArgs
    >({
      query: ({
        page,
        paginate,
        search,
        searchBySpecific,
        question_category_id,
        orderBy,
        order,
      }) => {
        const qs = new URLSearchParams();
        qs.set("page", String(page));
        qs.set("paginate", String(paginate));

        if (search && search.trim()) qs.set("search", search.trim());
        if (searchBySpecific && searchBySpecific.trim()) {
          qs.set("searchBySpecific", searchBySpecific.trim());
        }
        if (typeof question_category_id !== "undefined") {
          qs.set("question_category_id", String(question_category_id));
        }
        if (orderBy && orderBy.trim()) qs.set("orderBy", orderBy.trim());
        if (order && (order === "asc" || order === "desc")) {
          qs.set("order", order);
        }

        return {
          url: `/master/questions?${qs.toString()}`,
          method: "GET",
        };
      },
      transformResponse: (response: {
        code: number;
        message: string;
        data: {
          current_page: number;
          data: Questions[];
          last_page: number;
          total: number;
          per_page: number;
        };
      }) => ({
        data: response.data.data,
        last_page: response.data.last_page,
        current_page: response.data.current_page,
        total: response.data.total,
        per_page: response.data.per_page,
      }),
    }),

    // Get by ID
    getQuestionById: builder.query<Questions, number>({
      query: (id) => ({
        url: `/master/questions/${id}`,
        method: "GET",
      }),
      transformResponse: (response: {
        code: number;
        message: string;
        data: Questions;
      }) => response.data,
    }),

    // Create
    createQuestion: builder.mutation<Questions, CreateQuestionPayload>({
      query: (payload) => ({
        url: `/master/questions`,
        method: "POST",
        body: payload,
      }),
      transformResponse: (response: {
        code: number;
        message: string;
        data: Questions;
      }) => response.data,
    }),

    // Update
    updateQuestion: builder.mutation<
      Questions,
      { id: number; payload: UpdateQuestionPayload }
    >({
      query: ({ id, payload }) => ({
        url: `/master/questions/${id}`,
        method: "PUT",
        body: payload,
      }),
      transformResponse: (response: {
        code: number;
        message: string;
        data: Questions;
      }) => response.data,
    }),

    // Delete
    deleteQuestion: builder.mutation<{ code: number; message: string }, number>(
      {
        query: (id) => ({
          url: `/master/questions/${id}`,
          method: "DELETE",
        }),
        transformResponse: (response: {
          code: number;
          message: string;
          data: null;
        }) => ({
          code: response.code,
          message: response.message,
        }),
      }
    ),

    /** ================== NEW: TEMPLATE / IMPORT / EXPORT ================== */

    /**
     * Template CSV untuk impor soal.
     * Tidak perlu request jaringan — URL disediakan langsung agar bisa dipakai pada `<a href={url} download>`.
     */
    getQuestionImportTemplate: builder.query<string, void>({
      queryFn: async () => ({ data: QUESTION_IMPORT_TEMPLATE_URL }),
    }),

    /**
     * Import soal (POST /master/questions/import)
     * Body harus berupa FormData: { file, question_category_id }
     * Server mengembalikan notifikasi "Processing import request..." (asynchronous).
     */
    importQuestions: builder.mutation<
      { code: number; message: string; data?: unknown },
      QuestionImportPayload
    >({
      query: ({ file, question_category_id }) => {
        const form = new FormData();
        form.append("file", file);
        form.append("question_category_id", String(question_category_id));
        return {
          url: `/master/questions/import`,
          method: "POST",
          body: form,
        };
      },
      transformResponse: (response: {
        code: number;
        message: string;
        data?: unknown;
      }) => response,
    }),

    /**
     * Export soal (POST /master/questions/export)
     * Body: { question_category_id }
     * Response.data diharapkan string notifikasi (job telah diproses atau link siap unduh).
     */
    exportQuestions: builder.mutation<
      { code: number; message: string; data: string },
      QuestionExportPayload
    >({
      query: ({ question_category_id }) => ({
        url: `/master/questions/export`,
        method: "POST",
        body: { question_category_id },
      }),
      transformResponse: (response: {
        code: number;
        message: string;
        data: string;
      }) => response,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetQuestionListQuery,
  useGetQuestionByIdQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useGetQuestionImportTemplateQuery,
  useImportQuestionsMutation,
  useExportQuestionsMutation,
} = questionsApi;