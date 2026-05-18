import pytest

from apps.grammar.models import GrammarCategory, GrammarDrillItem, GrammarTopic


@pytest.mark.django_db
def test_grammar_category_topic_drill_default_to_fr():
    cat = GrammarCategory.objects.create(name="Verbs", slug="verbs")
    topic = GrammarTopic.objects.create(
        category=cat, title="Présent", slug="present", explanation="."
    )
    drill = GrammarDrillItem.objects.create(
        topic=topic, prompt="p", correct_answer="a", type="fill_blank"
    )
    assert cat.language == "fr"
    assert topic.language == "fr"
    assert drill.language == "fr"


@pytest.mark.django_db
def test_grammar_topic_can_be_en():
    cat = GrammarCategory.objects.create(name="Tenses", slug="tenses-en", language="en")
    topic = GrammarTopic.objects.create(
        category=cat,
        title="Present Simple",
        slug="present-simple",
        explanation=".",
        language="en",
    )
    assert topic.language == "en"
