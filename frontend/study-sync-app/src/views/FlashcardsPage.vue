<template>
  <div class="flashcards-page">
    <v-container>
      <h1 class="page-title">🧠 AI Flashcards</h1>
      <p class="page-subtitle">
        Create, review, and generate flashcards with spaced repetition.
      </p>

      <v-tabs v-model="activeTab" background-color="primary" class="mb-4">
        <v-tab value="browse">Browse</v-tab>
        <v-tab value="create">Create</v-tab>
        <v-tab value="review">Review</v-tab>
        <v-tab value="generate">Generate</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <v-window-item value="browse">
          <v-row class="mb-4">
            <v-col cols="12" md="6">
              <v-text-field
                v-model="searchQuery"
                label="Search flashcards..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                clearable
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedCategory"
                :items="categories"
                label="Filter by Category"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-row v-if="loading">
            <v-col cols="12" class="text-center">
              <v-progress-circular indeterminate color="primary" size="64" />
            </v-col>
          </v-row>

          <v-row v-else>
            <v-col
              v-for="card in filteredFlashcards"
              :key="card._id"
              cols="12"
              md="6"
              lg="4"
            >
              <v-card class="flashcard-card" elevation="3">
                <v-card-title class="d-flex justify-space-between align-center">
                  <div>
                    <div class="flashcard-front">{{ card.front }}</div>
                    <v-chip small color="primary" text-color="white">
                      {{ card.category || "General" }}
                    </v-chip>
                  </div>
                  <div>
                    <v-chip
                      small
                      :color="isDue(card) ? 'error' : 'success'"
                      text-color="white"
                    >
                      {{
                        isDue(card)
                          ? "Due"
                          : "Next: " + formatDate(card.dueDate)
                      }}
                    </v-chip>
                  </div>
                </v-card-title>

                <v-card-text>
                  <p class="flashcard-back">{{ card.back }}</p>
                  <div class="tag-row">
                    <v-chip
                      v-for="tag in card.tags"
                      :key="tag"
                      small
                      class="ma-1"
                      variant="tonal"
                    >
                      {{ tag }}
                    </v-chip>
                  </div>
                </v-card-text>

                <v-card-actions>
                  <v-btn
                    color="success"
                    variant="elevated"
                    size="small"
                    @click="reviewFlashcard(card, 3)"
                  >
                    Review
                  </v-btn>
                  <v-spacer />
                  <v-btn
                    color="error"
                    variant="text"
                    size="small"
                    @click="confirmDeleteFlashcard(card)"
                  >
                    Delete
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>

            <v-col
              v-if="filteredFlashcards.length === 0"
              cols="12"
              class="text-center"
            >
              <v-icon size="64" color="grey">mdi-flashcard-outline</v-icon>
              <p class="text-h6 mt-4">No flashcards found</p>
              <p class="text-body-2">
                Create or generate flashcards to begin your review.
              </p>
            </v-col>
          </v-row>
        </v-window-item>

        <v-window-item value="create">
          <v-card elevation="3" class="pa-4">
            <v-card-title class="text-h5 mb-4"
              >Create New Flashcard</v-card-title
            >
            <v-form ref="flashcardForm">
              <v-text-field
                v-model="newCard.front"
                label="Front of card *"
                variant="outlined"
                :rules="[rules.required]"
              />
              <v-textarea
                v-model="newCard.back"
                label="Back of card *"
                variant="outlined"
                rows="4"
                :rules="[rules.required]"
              />
              <v-select
                v-model="newCard.category"
                :items="categories.filter((c) => c !== 'All')"
                label="Category"
                variant="outlined"
              />
              <v-text-field
                v-model="newCard.tags"
                label="Tags (comma separated)"
                variant="outlined"
              />

              <v-card-actions class="mt-4">
                <v-spacer />
                <v-btn color="grey" variant="text" @click="resetFlashcardForm">
                  Reset
                </v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  @click="createFlashcard"
                >
                  Save Flashcard
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card>
        </v-window-item>

        <v-window-item value="review">
          <div v-if="reviewLoading" class="text-center py-16">
            <v-progress-circular indeterminate color="primary" size="64" />
          </div>

          <div v-else-if="dueFlashcards.length === 0" class="text-center py-16">
            <v-icon size="72" color="grey">mdi-calendar-check</v-icon>
            <p class="text-h6 mt-4">
              No flashcards are due for review right now.
            </p>
            <p class="text-body-2">
              Come back later to strengthen your recall.
            </p>
          </div>

          <div v-else>
            <v-card elevation="3" class="pa-6">
              <div class="d-flex justify-space-between align-center mb-4">
                <div>
                  <h2 class="text-h5 mb-2">Review session</h2>
                  <p class="text-body-2">
                    {{ dueFlashcards.length }} card(s) due for review.
                  </p>
                </div>
                <v-chip color="error" text-color="white"> Due Today </v-chip>
              </div>

              <div v-for="card in dueFlashcards" :key="card._id" class="mb-4">
                <v-card class="pa-4" variant="tonal">
                  <h3 class="mb-3">{{ card.front }}</h3>
                  <p class="mb-4">{{ card.back }}</p>
                  <div class="review-button-group">
                    <v-btn color="error" @click="reviewFlashcard(card, 0)"
                      >Again</v-btn
                    >
                    <v-btn color="warning" @click="reviewFlashcard(card, 3)"
                      >Good</v-btn
                    >
                    <v-btn color="success" @click="reviewFlashcard(card, 5)"
                      >Easy</v-btn
                    >
                  </div>
                </v-card>
              </div>
            </v-card>
          </div>
        </v-window-item>

        <v-window-item value="generate">
          <v-card elevation="3" class="pa-4">
            <v-card-title class="text-h5 mb-4"
              >Generate Flashcards from Text</v-card-title
            >
            <v-textarea
              v-model="generateText"
              label="Paste course notes or topic description"
              variant="outlined"
              rows="6"
            />
            <v-text-field
              v-model="generateCount"
              label="Number of flashcards"
              type="number"
              min="1"
              max="10"
              variant="outlined"
              class="mt-4"
            />
            <v-card-actions class="mt-4">
              <v-spacer />
              <v-btn
                color="primary"
                variant="elevated"
                :loading="generating"
                :disabled="generating"
                @click="generateFlashcards"
              >
                {{ generating ? "Generating..." : "Generate" }}
              </v-btn>
            </v-card-actions>
          </v-card>

          <div v-if="generatedCards.length" class="mt-6">
            <v-row>
              <v-col
                cols="12"
                class="d-flex justify-space-between align-center mb-3"
              >
                <div>
                  <h3 class="text-h6">Generated Flashcards</h3>
                  <p class="text-body-2">
                    Review the AI-generated cards below and save the ones you
                    want.
                  </p>
                </div>
                <v-btn
                  color="success"
                  variant="elevated"
                  @click="saveAllGeneratedCards"
                >
                  Save All
                </v-btn>
              </v-col>
            </v-row>

            <v-row>
              <v-col
                v-for="(card, index) in generatedCards"
                :key="index"
                cols="12"
                md="6"
              >
                <v-card class="pa-4" elevation="2">
                  <h4 class="mb-3">{{ card.front }}</h4>
                  <p class="mb-4">{{ card.back }}</p>
                  <div class="d-flex justify-space-between align-center">
                    <span class="text-caption"
                      >Category: {{ card.category }}</span
                    >
                    <v-btn
                      color="primary"
                      variant="text"
                      size="small"
                      @click="saveGeneratedCard(card, index)"
                    >
                      Save
                    </v-btn>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-window-item>
      </v-window>

      <v-dialog v-model="deleteDialog" max-width="420px">
        <v-card>
          <v-card-title>Confirm Delete</v-card-title>
          <v-card-text
            >Are you sure you want to delete this flashcard?</v-card-text
          >
          <v-card-actions>
            <v-spacer />
            <v-btn color="grey" variant="text" @click="deleteDialog = false"
              >Cancel</v-btn
            >
            <v-btn color="error" variant="elevated" @click="deleteFlashcard"
              >Delete</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
        {{ snackbarText }}
      </v-snackbar>
    </v-container>
  </div>
</template>

<script>
import api from "../api";
import { mapState } from "vuex";

export default {
  name: "FlashcardsPage",
  data() {
    return {
      activeTab: "browse",
      flashcards: [],
      dueFlashcards: [],
      loading: false,
      reviewLoading: false,
      searchQuery: "",
      selectedCategory: "All",
      categories: [
        "All",
        "Mathematics",
        "Science",
        "Programming",
        "Languages",
        "History",
        "General",
      ],
      newCard: {
        front: "",
        back: "",
        category: "General",
        tags: "",
      },
      deleteDialog: false,
      selectedFlashcardToDelete: null,
      generating: false,
      generateText: "",
      generateCount: 5,
      generatedCards: [],
      snackbar: false,
      snackbarText: "",
      snackbarColor: "success",
      rules: {
        required: (value) =>
          (value !== null && value !== undefined && value !== "") ||
          "Required.",
      },
    };
  },
  computed: {
    ...mapState(["token"]),
    filteredFlashcards() {
      let filtered = this.flashcards;

      if (this.selectedCategory !== "All") {
        filtered = filtered.filter(
          (card) => card.category === this.selectedCategory,
        );
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (card) =>
            card.front.toLowerCase().includes(query) ||
            card.back.toLowerCase().includes(query) ||
            (card.tags || []).some((tag) => tag.toLowerCase().includes(query)),
        );
      }

      return filtered;
    },
  },
  created() {
    this.fetchFlashcards();
    this.fetchDueFlashcards();
  },
  methods: {
    async fetchFlashcards() {
      this.loading = true;
      try {
        const response = await api.get("/flashcards");
        if (response.data.success) {
          this.flashcards = response.data.flashcards;
        }
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error fetching flashcards", "error");
      } finally {
        this.loading = false;
      }
    },
    async fetchDueFlashcards() {
      this.reviewLoading = true;
      try {
        const response = await api.get("/flashcards", {
          params: { due: true },
        });
        if (response.data.success) {
          this.dueFlashcards = response.data.flashcards;
        }
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error fetching due flashcards", "error");
      } finally {
        this.reviewLoading = false;
      }
    },
    async createFlashcard() {
      const valid = await this.$refs.flashcardForm.validate();
      if (!valid) return;

      try {
        await api.post("/flashcards", {
          front: this.newCard.front,
          back: this.newCard.back,
          category: this.newCard.category,
          tags: this.newCard.tags,
        });
        this.showSnackbar("Flashcard created successfully", "success");
        this.resetFlashcardForm();
        this.fetchFlashcards();
        this.fetchDueFlashcards();
        this.activeTab = "browse";
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error creating flashcard", "error");
      }
    },
    resetFlashcardForm() {
      this.newCard = {
        front: "",
        back: "",
        category: "General",
        tags: "",
      };
    },
    confirmDeleteFlashcard(card) {
      this.selectedFlashcardToDelete = card;
      this.deleteDialog = true;
    },
    async deleteFlashcard() {
      if (!this.selectedFlashcardToDelete) return;

      try {
        await api.delete(`/flashcards/${this.selectedFlashcardToDelete._id}`);
        this.showSnackbar("Flashcard deleted successfully", "success");
        this.fetchFlashcards();
        this.fetchDueFlashcards();
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error deleting flashcard", "error");
      } finally {
        this.deleteDialog = false;
        this.selectedFlashcardToDelete = null;
      }
    },
    async reviewFlashcard(card, quality) {
      try {
        const response = await api.post(`/flashcards/${card._id}/review`, {
          quality,
        });
        if (response.data.success) {
          this.showSnackbar("Review recorded", "success");
          this.fetchFlashcards();
          this.fetchDueFlashcards();
        }
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error recording review", "error");
      }
    },
    async generateFlashcards() {
      if (!this.generateText.trim()) {
        this.showSnackbar("Enter study text to generate flashcards", "error");
        return;
      }

      // Phase 7: Prevent simultaneous requests
      if (this.generating) {
        this.showSnackbar(
          "Flashcards are already being generated. Please wait.",
          "warning",
        );
        return;
      }

      this.generating = true;
      this.generatedCards = [];

      // Phase 8: Set timeout warning
      const timeoutWarning = setTimeout(() => {
        if (this.generating) {
          this.showSnackbar(
            "Generation is taking longer than expected. Please be patient, this may take up to 3 minutes.",
            "warning",
          );
        }
      }, 30000); // 30 second warning

      try {
        const response = await api.post("/flashcards/generate", {
          text: this.generateText,
          count: this.generateCount,
        });

        if (response.data.success) {
          this.generatedCards = response.data.flashcards;
          this.showSnackbar("Generated flashcards successfully", "success");
        }
      } catch (error) {
        console.error(error);

        // Phase 7: Better timeout error messages
        if (
          error.message?.includes("timeout") ||
          error.code === "ECONNABORTED"
        ) {
          this.showSnackbar(
            "Generation timed out. Try with shorter text or fewer cards.",
            "error",
          );
        } else if (error.response?.status === 503) {
          this.showSnackbar(
            "AI service is temporarily unavailable. Please try again later.",
            "error",
          );
        } else {
          this.showSnackbar("Error generating flashcards", "error");
        }
      } finally {
        clearTimeout(timeoutWarning);
        this.generating = false;
      }
    },
    async saveGeneratedCard(card, index) {
      try {
        await api.post("/flashcards", {
          front: card.front,
          back: card.back,
          category: card.category,
          tags: card.tags,
        });
        this.generatedCards.splice(index, 1);
        this.fetchFlashcards();
        this.fetchDueFlashcards();
        this.showSnackbar("Flashcard saved", "success");
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error saving generated card", "error");
      }
    },
    async saveAllGeneratedCards() {
      if (!this.generatedCards.length) return;

      try {
        for (const card of this.generatedCards) {
          await api.post("/flashcards", {
            front: card.front,
            back: card.back,
            category: card.category,
            tags: card.tags,
          });
        }
        this.generatedCards = [];
        this.fetchFlashcards();
        this.fetchDueFlashcards();
        this.showSnackbar("All generated flashcards saved", "success");
      } catch (error) {
        console.error(error);
        this.showSnackbar("Error saving generated cards", "error");
      }
    },
    formatDate(value) {
      if (!value) return "Not scheduled";
      return new Date(value).toLocaleDateString();
    },
    isDue(card) {
      return new Date(card.dueDate) <= new Date();
    },
    showSnackbar(text, color) {
      this.snackbarText = text;
      this.snackbarColor = color;
      this.snackbar = true;
    },
  },
};
</script>

<style scoped>
.flashcards-page {
  padding: 2em 1em;
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #d7e8ff 0%, #f7f3ff 100%);
}

.page-title {
  text-align: center;
  font-size: 3em;
  font-weight: 700;
  color: #1e3a8a;
  margin-bottom: 0.25em;
}

.page-subtitle {
  text-align: center;
  font-size: 1.2em;
  color: #475569;
  margin-bottom: 2rem;
}

.flashcard-card {
  transition: all 0.3s ease;
  border-radius: 18px !important;
  overflow: hidden;
  padding: 1em;
}

.flashcard-card:hover {
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12) !important;
}

.flashcard-front {
  font-size: 1.1em;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.5em;
}

.flashcard-back {
  color: #334155;
  line-height: 1.6;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.review-button-group > * {
  margin-right: 1rem;
}
</style>
