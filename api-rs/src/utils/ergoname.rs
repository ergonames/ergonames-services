use regex::Regex;

pub fn check_ergoname_availability(ergoname: &str) -> bool {
    if ergoname == "mgpai" {
        return false;
    }
    true
}

pub fn check_ergoname_validity(ergoname: &str) -> bool {
    let length = ergoname.len();
    if length < 3 || length > 25 {
        return false;
    }
    let regex = Regex::new(r"^[a-zA-Z1-9-]+$").unwrap();
    if !regex.is_match(ergoname) {
        return false;
    }
    return true;
}

pub fn get_current_mint_cost(ergoname: &str) -> u16 {
    if !check_ergoname_validity(ergoname) {
        return 0;
    }
    let cost = match ergoname.len() {
        3 => 500,
        4 => 150,
        5 => 50,
        6 => 50,
        7 => 15,
        8 => 15,
        _ => 5,
    };
    return cost;
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_check_ergoname_validity() {
        assert_eq!(super::check_ergoname_validity("balb"), true);
        assert_eq!(super::check_ergoname_validity("balb-"), true);
        assert_eq!(super::check_ergoname_validity("balb-1"), true);
        assert_eq!(super::check_ergoname_validity("ba"), false);
        assert_eq!(
            super::check_ergoname_validity("balbbalbbalbbalbbalbbalbbalb"),
            false
        );
        assert_eq!(super::check_ergoname_validity("balb!"), false);
    }

    #[test]
    fn test_check_ergoname_availability() {
        assert_eq!(super::check_ergoname_availability("mgpai"), false);
        assert_eq!(super::check_ergoname_availability("gjdkskjfjskfjsjw"), true);
    }

    #[test]
    fn test_ergoname_cost() {
        assert_eq!(super::get_current_mint_cost("ba"), 0);
        assert_eq!(super::get_current_mint_cost("bal"), 500);
        assert_eq!(super::get_current_mint_cost("balb"), 150);
        assert_eq!(super::get_current_mint_cost("balbb"), 50);
        assert_eq!(super::get_current_mint_cost("balbba"), 50);
        assert_eq!(super::get_current_mint_cost("balbbal"), 15);
        assert_eq!(super::get_current_mint_cost("balbbalb"), 15);
        assert_eq!(super::get_current_mint_cost("balbbalbb"), 5);
        assert_eq!(
            super::get_current_mint_cost("balbbalbbalbbalbbalbbalbbalb"),
            0
        );
    }
}
