import django, csv, json, re
from typing import List, Optional, Union, Tuple
django.setup()
from tqdm import tqdm
from sefaria.model import *
from sefaria.model.ref_part import ResolvedRawRef, RefPartType
from sefaria.helper.normalization import NormalizerComposer

VTITLE = 'Guggenheimer Translation 2.1'

def get_window_around_match(start_char:int, end_char:int, text:str, window:int=10) -> tuple:
    before_window, after_window = '', ''

    before_text = text[:start_char]
    before_window_words = list(filter(lambda x: len(x) > 0, before_text.split()))[-window:]
    before_window = " ".join(before_window_words)

    after_text = text[end_char:]
    after_window_words = list(filter(lambda x: len(x) > 0, after_text.split()))[:window]
    after_window = " ".join(after_window_words)

    return before_window, after_window


class YerushalmiCatcher:

    def __init__(self, lang: str, vtitle: str):
        self.footnote_map = self.create_footnote_mapping()
        self.lang = lang
        self.vtitle = vtitle
        self.resolver = library.get_ref_resolver()
        self.normalizer = NormalizerComposer(['unidecode', 'html', 'maqaf', 'cantillation', 'double-space'])
        self.output_file = open('../data/yerushalmi_translation_refs.csv', 'w')
        self.output_csv = csv.DictWriter(self.output_file, ['Context Ref', 'Before', 'Raw Ref', 'After', 'Raw Ref', 'Parsed Ref', 'Ref Parts'])
        self.output_csv.writeheader()

    @staticmethod
    def create_footnote_mapping():
        from bs4 import BeautifulSoup
        footnote_map = {}

        def footnote_mapper(s: str, en_tref: str, he_tref: str, version: Version) -> None:
            nonlocal footnote_map
            chapter_ref = Ref(en_tref.split(':')[0])
            soup = BeautifulSoup("<root>{}</root>".format(s), 'lxml')
            itag_list = soup.find_all(TextChunk._find_itags)
            for itag in itag_list:
                if itag.name != 'sup': continue  # technically possible but dont think this happens
                try:
                    footnote_text = itag.text.replace(',', '')
                    footnote_num = int(footnote_text)
                except ValueError:
                    # print(f"non-numeric footnote {itag.text}")
                    continue
                if footnote_num in footnote_map: continue  # only map to the first occurrence of footnote_num
                footnote_map[(chapter_ref.normal(), footnote_num)] = en_tref

        for title in tqdm(library.get_indexes_in_category("Yerushalmi")):
            version = Version().load({"title": title, "versionTitle": VTITLE, "language": "en"})
            if version is None: print("None version", title); continue
            version.walk_thru_contents(footnote_mapper)

        return footnote_map

    def catch_refs_in_category(self, cat: str):
        for title in library.get_indexes_in_category(cat):
            self.catch_refs_in_title(title)

    def catch_refs_in_title(self, title: str):
        version = Version().load({"title": title, "language": self.lang, "versionTitle": self.vtitle})
        version.walk_thru_contents(self.catch_refs_in_ref)

    def catch_refs_in_ref(self, st: str, en_tref: str, he_tref: str, version: Version) -> None:
        print(en_tref)
        context_ref = Ref(en_tref)
        norm_st = self.normalizer.normalize(st)
        resolved_refs = self.resolver.resolve_refs_in_string(self.lang, context_ref, norm_st, with_failures=True)
        resolved_refs = self.post_process_resolved_refs(resolved_refs, context_ref)
        norm_indices = [r.raw_ref.char_indices for r in resolved_refs]
        mapping = self.normalizer.get_mapping_after_normalization(st)
        orig_indices = self.normalizer.convert_normalized_indices_to_unnormalized_indices(norm_indices, mapping)

        for resolved_ref, (start_char, end_char) in zip(resolved_refs, orig_indices):
            before_context, after_context = get_window_around_match(start_char, end_char, st)
            self.output_csv.writerow({
                "Context Ref": en_tref,
                "Before": before_context,
                "After": after_context,
                "Raw Ref": resolved_ref.raw_ref.text,
                "Parsed Ref": resolved_ref.ref.normal() if resolved_ref.ref is not None else "",
                "Ref Parts": "|".join(part.text for part in resolved_ref.raw_ref.raw_ref_parts),
            })

    def finish(self):
        self.output_file.close()

    def get_note_ref(self, raw_ref_text, context_ref: Ref) -> Optional[Ref]:
        m = re.search(r"Notes? (\d+)(?:[\-–](\d+))?", raw_ref_text)
        sec_fn = int(m.group(1))
        try:
            toSec_fn = int(m.group(2))
        except (IndexError, TypeError):
            toSec_fn = None
        chap_ref = context_ref.normal().split(':')[0]
        sec = self.footnote_map.get((chap_ref, sec_fn), None)
        toSec = self.footnote_map.get((chap_ref, toSec_fn), None)
        if sec is not None:
            new_ref = Ref(sec)
            if toSec is not None:
                new_ref = new_ref.to(Ref(toSec))
            return new_ref

    def post_process_resolved_refs(self, resolved_refs: List[ResolvedRawRef], context_ref: Ref) -> List[ResolvedRawRef]:
        prev_resolved_ref = None
        for resolved_ref in resolved_refs:
            parts = resolved_ref.raw_ref.raw_ref_parts
            if resolved_ref.ref is not None:
                if resolved_ref.ref.is_book_level():
                    resolved_ref.ref = None
                elif len(parts) == 2 and parts[0].text in {"Mishnah", "Mishnaiot"} and parts[1].type in {RefPartType.NUMBERED, RefPartType.RANGE}:
                    mishnah_sec = resolved_ref.ref.sections[0]
                    mishnah_toSec = resolved_ref.ref.toSections[0]
                    if mishnah_sec != mishnah_toSec:
                        end_secs = f"{mishnah_sec}:1-{mishnah_toSec}:1"
                    else:
                        end_secs = mishnah_sec
                    perek = context_ref.sections[0]
                    resolved_ref.ref = Ref(f"{context_ref.index.title} {perek}:{end_secs}")  # super hacky, but what can ya do?
                elif resolved_ref.ref.index.title.startswith('Jerusalem Talmud ') and re.search(r"Notes? \d+", resolved_ref.raw_ref.text) is not None:
                    note_ref = self.get_note_ref(resolved_ref.raw_ref.text, resolved_ref.ref)
                    if note_ref is not None:
                        resolved_ref.ref = note_ref
                elif resolved_ref.ambiguous and '/'.join(resolved_ref.ref.index.categories).startswith('Tosefta/Vilna Edition/'):
                    # delete vilan tosefta when liberman exists
                    resolved_ref.ref = None
            if resolved_ref.ref is None:
                if 1 <= len(parts) <= 2 and re.search(r"^[vV] ?\. \d+", parts[0].text) is not None and prev_resolved_ref is not None and prev_resolved_ref.ref is not None and prev_resolved_ref.ref.primary_category == "Tanakh":
                    if len(parts) == 1:
                        pasuk = re.search(r"^[vV] ?\. (\d+)", parts[0].text).group(1)
                        perek = prev_resolved_ref.ref.sections[0]
                        sections = f"{perek}:{pasuk}"
                    else:
                        sections = re.sub(r"^[vV] ?\. ", "", resolved_ref.raw_ref.text)
                    resolved_ref.ref = Ref(f"{prev_resolved_ref.ref.index.title} {sections}")
                elif len(parts) == 1 and re.search(r"^vv ?\. \d+", parts[0].text) is not None and prev_resolved_ref is not None and prev_resolved_ref.ref is not None and prev_resolved_ref.ref.primary_category == "Tanakh":
                    sections = re.sub(r"^vv ?\. ", "", parts[0].text)
                    title = prev_resolved_ref.ref.index.title
                    resolved_ref.ref = Ref(f"{title} {sections}")
                elif re.search(r"^Notes? \d+", resolved_ref.raw_ref.text) is not None:
                    note_ref = self.get_note_ref(resolved_ref.raw_ref.text, context_ref)
                    if note_ref is not None:
                        resolved_ref.ref = note_ref
            prev_resolved_ref = resolved_ref

        return resolved_refs


if __name__ == '__main__':
    catcher = YerushalmiCatcher('en', VTITLE)
    catcher.catch_refs_in_title('Jerusalem Talmud Pesachim')
    catcher.finish()

"""
post processing


TODO
- figure out how to throw out bad matches (especially ones that resolve to title context like "Derekh Eres Rabba 1")
- "Chapter 1, Note 104" no longer works b/c we're stricter on title context
- for vv., check if : to see if you need to pull perek from prev ref

Alt titles to deal with
- Ex. rabba 15(17
- Mekhilta dR. Ismael Bo Chap. 14
- Sifra Qedošim Pereq 11(8
- Sifry Num. 84, 161
- Midrash Ps.
- Tanhuma Mas`e 6
- Thr. rabba
- Sifry Deut . #288
- Derekh Eres Rabba 1
- Bemidbar rabba, Tanhuma , both Pesiqtot , to Huqqat ( Parah )
- Sifry zuta Behaˋalotekha 9(2
- Šulhan Arukh Yoreh Deˋa 89(4
- Or Zaruaˋ II §229

Examples to train on
Jerusalem Talmud Taanit 1:1:18
Jerusalem Talmud Taanit 2:4:1
Jerusalem Talmud Taanit 2:2:3
Jerusalem Talmud Taanit 4:7:2
Jerusalem Talmud Yevamot 1:2:9
Jerusalem Talmud Yevamot 1:1:6
Jerusalem Talmud Pesachim 7:1:10
Jerusalem Talmud Pesachim 1:5:2
Jerusalem Talmud Pesachim 9:6:2
Jerusalem Talmud Pesachim 10:6:3
Jerusalem Talmud Pesachim 4:9:3
Jerusalem Talmud Pesachim 5:4:6
Jerusalem Talmud Pesachim 5:8:3
Jerusalem Talmud Pesachim 7:7:8
"""
