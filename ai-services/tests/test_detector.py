from whisper.detector import DistressDetector


def test_check_keywords_match() -> None:
    detector = DistressDetector()
    result = detector._check_keywords("Please help me I'm in danger")
    assert result.detected is True
    assert result.matched_keyword == "help"


def test_check_keywords_no_match() -> None:
    detector = DistressDetector()
    result = detector._check_keywords("The weather is nice today")
    assert result.detected is False
    assert result.matched_keyword is None


def test_custom_keywords() -> None:
    detector = DistressDetector(keywords=["fire", "earthquake"])
    result = detector._check_keywords("There is a fire!")
    assert result.detected is True
    assert result.matched_keyword == "fire"
